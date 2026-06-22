import {
  projectInsights,
  recommendationFeedback,
  recommendations,
  risks,
  withTenantContext,
  type Database,
} from '@beacon/db';
import {
  computeFeedbackSummary,
  recommendationStatusFromFeedback,
  type FeedbackRating,
  type FeedbackTargetType,
  type RecommendationFeedbackRecord,
  type TrainingFeedbackExportRow,
} from '@beacon/shared/recommendation-feedback';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

function serializeFeedback(row: typeof recommendationFeedback.$inferSelect): RecommendationFeedbackRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    projectId: row.projectId,
    riskId: row.riskId,
    insightId: row.insightId,
    recommendationId: row.recommendationId,
    targetType: row.targetType,
    rating: row.rating,
    comment: row.comment,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function syncRecommendationStatus(
  db: Database,
  tenantId: string,
  riskId: string | null,
  rating: FeedbackRating,
): Promise<void> {
  if (!riskId) return;
  await db
    .update(recommendations)
    .set({
      status: recommendationStatusFromFeedback(rating),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recommendations.tenantId, tenantId),
        eq(recommendations.riskId, riskId),
        isNull(recommendations.deletedAt),
      ),
    );
}

export async function submitRecommendationFeedback(
  db: Database,
  tenantId: string,
  userId: string,
  input: {
    projectId: string;
    targetType: FeedbackTargetType;
    targetId: string;
    rating: FeedbackRating;
    comment?: string;
  },
): Promise<RecommendationFeedbackRecord> {
  return withTenantContext(db, tenantId, async () => {
    let riskId: string | null = null;
    let insightId: string | null = null;
    let recommendationId: string | null = null;
    const metadata: Record<string, unknown> = {};

    if (input.targetType === 'insight') {
      const [insight] = await db
        .select()
        .from(projectInsights)
        .where(
          and(
            eq(projectInsights.id, input.targetId),
            eq(projectInsights.tenantId, tenantId),
            eq(projectInsights.projectId, input.projectId),
            isNull(projectInsights.deletedAt),
          ),
        )
        .limit(1);
      if (!insight) throw new Error('Insight not found');
      riskId = insight.riskId;
      insightId = insight.id;
      metadata.insightSource = insight.source;
      metadata.evidenceHash = insight.evidenceHash;
    } else {
      const [recommendation] = await db
        .select()
        .from(recommendations)
        .where(
          and(
            eq(recommendations.id, input.targetId),
            eq(recommendations.tenantId, tenantId),
            eq(recommendations.projectId, input.projectId),
            isNull(recommendations.deletedAt),
          ),
        )
        .limit(1);
      if (!recommendation) throw new Error('Recommendation not found');
      riskId = recommendation.riskId;
      recommendationId = recommendation.id;
    }

    if (riskId) {
      const [risk] = await db
        .select({ ruleKey: risks.ruleKey })
        .from(risks)
        .where(and(eq(risks.id, riskId), eq(risks.tenantId, tenantId)))
        .limit(1);
      metadata.ruleKey = risk?.ruleKey ?? null;
    }

    const existing =
      input.targetType === 'insight'
        ? await db
            .select()
            .from(recommendationFeedback)
            .where(
              and(
                eq(recommendationFeedback.tenantId, tenantId),
                eq(recommendationFeedback.userId, userId),
                eq(recommendationFeedback.insightId, insightId!),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : await db
            .select()
            .from(recommendationFeedback)
            .where(
              and(
                eq(recommendationFeedback.tenantId, tenantId),
                eq(recommendationFeedback.userId, userId),
                eq(recommendationFeedback.recommendationId, recommendationId!),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null);

    let row;
    if (existing) {
      [row] = await db
        .update(recommendationFeedback)
        .set({
          rating: input.rating,
          comment: input.comment ?? null,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(recommendationFeedback.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(recommendationFeedback)
        .values({
          tenantId,
          userId,
          projectId: input.projectId,
          riskId,
          insightId,
          recommendationId,
          targetType: input.targetType,
          rating: input.rating,
          comment: input.comment ?? null,
          metadata,
        })
        .returning();
    }

    await syncRecommendationStatus(db, tenantId, riskId, input.rating);
    return serializeFeedback(row!);
  });
}

export async function listProjectFeedbackForUser(
  db: Database,
  tenantId: string,
  userId: string,
  projectId: string,
): Promise<RecommendationFeedbackRecord[]> {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(recommendationFeedback)
      .where(
        and(
          eq(recommendationFeedback.tenantId, tenantId),
          eq(recommendationFeedback.userId, userId),
          eq(recommendationFeedback.projectId, projectId),
        ),
      )
      .orderBy(desc(recommendationFeedback.updatedAt));
    return rows.map(serializeFeedback);
  });
}

export async function getFeedbackSummary(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select({
        rating: recommendationFeedback.rating,
        targetType: recommendationFeedback.targetType,
        insightSource: sql<string | null>`${recommendationFeedback.metadata}->>'insightSource'`,
      })
      .from(recommendationFeedback)
      .where(eq(recommendationFeedback.tenantId, tenantId));

    return computeFeedbackSummary(
      rows.map((row) => ({
        rating: row.rating,
        targetType: row.targetType,
        insightSource: row.insightSource,
      })),
    );
  });
}

export async function exportTrainingFeedback(
  db: Database,
  tenantId: string,
  limit = 1000,
): Promise<TrainingFeedbackExportRow[]> {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select({
        feedback: recommendationFeedback,
        insight: projectInsights,
        recommendation: recommendations,
        risk: risks,
      })
      .from(recommendationFeedback)
      .leftJoin(projectInsights, eq(recommendationFeedback.insightId, projectInsights.id))
      .leftJoin(recommendations, eq(recommendationFeedback.recommendationId, recommendations.id))
      .leftJoin(risks, eq(recommendationFeedback.riskId, risks.id))
      .where(eq(recommendationFeedback.tenantId, tenantId))
      .orderBy(desc(recommendationFeedback.createdAt))
      .limit(limit);

    return rows.map(({ feedback, insight, recommendation, risk }) => ({
      feedbackId: feedback.id,
      tenantId: feedback.tenantId,
      projectId: feedback.projectId,
      riskId: feedback.riskId,
      ruleKey: risk?.ruleKey ?? (feedback.metadata.ruleKey as string | null) ?? null,
      targetType: feedback.targetType,
      rating: feedback.rating,
      comment: feedback.comment,
      rootCause: insight?.rootCause ?? null,
      recommendedAction:
        insight?.recommendedAction ?? recommendation?.suggestedAction ?? null,
      insightSource:
        insight?.source ?? (feedback.metadata.insightSource as string | null) ?? null,
      evidenceHash:
        insight?.evidenceHash ?? (feedback.metadata.evidenceHash as string | null) ?? null,
      createdAt: feedback.createdAt.toISOString(),
    }));
  });
}
