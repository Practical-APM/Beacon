import { riskEvaluationJobs, risks, withTenantContext, type Database } from '@beacon/db';
import {
  RISK_RULE_KEYS,
  aggregateCompositeRisk,
  applyHysteresis,
  severityIncreased,
  type DetectedRisk,
  type RiskRuleKey,
} from '@beacon/shared';
import { shouldExcludeFromActivePortfolio } from '@beacon/shared/graph';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import {
  listProjectsForBatchEvaluation,
  loadProjectEvaluationContext,
  listTenantIds,
} from './context.js';
import { evaluateAllRules } from './rules.js';
import type { OutboundRiskWebhookInput } from '@beacon/shared/outbound-webhooks';
import { mapRiskAlertToWebhookEvents } from '@beacon/shared/outbound-webhooks';
import type { RiskAlertEvent } from '../notifications/digest.js';

export interface RiskEvaluationResult {
  jobId: string;
  risksCreated: number;
  risksUpdated: number;
  risksResolved: number;
  detected: DetectedRisk[];
  composite: ReturnType<typeof aggregateCompositeRisk>;
}

function shouldSuppressExistingRisk(
  existing: typeof risks.$inferSelect,
  settings: { acknowledgedSuppressionDays: number },
): boolean {
  const now = Date.now();

  if (existing.status === 'snoozed' && existing.snoozedUntil && existing.snoozedUntil.getTime() > now) {
    return true;
  }

  if (existing.status === 'acknowledged' && existing.acknowledgedAt) {
    const suppressionMs = settings.acknowledgedSuppressionDays * 24 * 60 * 60 * 1000;
    if (now - existing.acknowledgedAt.getTime() < suppressionMs) {
      return true;
    }
  }

  return false;
}

async function persistProjectRisks(
  db: Database,
  tenantId: string,
  projectId: string,
  detected: DetectedRisk[],
  settings: { acknowledgedSuppressionDays: number; hysteresisBuffer: number },
): Promise<{
  created: number;
  updated: number;
  resolved: number;
  alertEvents: RiskAlertEvent[];
  outboundEvents: OutboundRiskWebhookInput[];
}> {
  return withTenantContext(db, tenantId, async () => {
    const existingRows = await db
      .select()
      .from(risks)
      .where(
        and(
          eq(risks.tenantId, tenantId),
          eq(risks.projectId, projectId),
          isNull(risks.deletedAt),
          inArray(risks.ruleKey, [...RISK_RULE_KEYS]),
        ),
      );

    const existingByRule = new Map(
      existingRows
        .filter((row) => row.ruleKey)
        .map((row) => [row.ruleKey as RiskRuleKey, row]),
    );

    let created = 0;
    let updated = 0;
    let resolved = 0;
    const alertEvents: RiskAlertEvent[] = [];
    const outboundEvents: OutboundRiskWebhookInput[] = [];
    const activeRuleKeys = new Set<RiskRuleKey>();

    for (const item of detected) {
      activeRuleKeys.add(item.ruleKey);
      const existing = existingByRule.get(item.ruleKey);

      if (existing && shouldSuppressExistingRisk(existing, settings)) {
        continue;
      }

      const level = existing
        ? applyHysteresis(existing.level, item.score, settings.hysteresisBuffer)
        : item.level;
      const score = item.score;

      if (!existing) {
        const [inserted] = await db.insert(risks).values({
          tenantId,
          projectId,
          ruleKey: item.ruleKey,
          level,
          status: 'open',
          score,
          reason: item.reason,
          confidence: item.confidence,
          evidence: item.evidence as unknown as Record<string, unknown>[],
          predictedDelayDays: item.predictedDelayDays ?? null,
        }).returning();
        created += 1;
        if (inserted) {
          alertEvents.push({
            riskId: inserted.id,
            projectId,
            level,
            previousLevel: null,
            isNew: true,
            severityIncreased: true,
            confidence: item.confidence,
            reason: item.reason,
          });
          outboundEvents.push(
            ...mapRiskAlertToWebhookEvents({
              tenantId,
              riskId: inserted.id,
              projectId,
              level,
              previousLevel: null,
              isNew: true,
              severityIncreased: true,
              confidence: item.confidence,
              reason: item.reason,
            }),
          );
        }
        continue;
      }

      if (existing.status === 'resolved') {
        await db
          .update(risks)
          .set({
            status: 'open',
            resolvedAt: null,
            level,
            score,
            reason: item.reason,
            confidence: item.confidence,
            evidence: item.evidence as unknown as Record<string, unknown>[],
            predictedDelayDays: item.predictedDelayDays ?? null,
            updatedAt: new Date(),
          })
          .where(eq(risks.id, existing.id));
        updated += 1;
        alertEvents.push({
          riskId: existing.id,
          projectId,
          level,
          previousLevel: existing.level,
          isNew: true,
          severityIncreased: true,
          confidence: item.confidence,
          reason: item.reason,
        });
        outboundEvents.push(
          ...mapRiskAlertToWebhookEvents({
            tenantId,
            riskId: existing.id,
            projectId,
            level,
            previousLevel: existing.level,
            isNew: true,
            severityIncreased: true,
            confidence: item.confidence,
            reason: item.reason,
          }),
        );
        continue;
      }

      const increased = severityIncreased(existing.level, level);
      await db
        .update(risks)
        .set({
          level,
          score,
          reason: item.reason,
          confidence: item.confidence,
          evidence: item.evidence as unknown as Record<string, unknown>[],
          predictedDelayDays: item.predictedDelayDays ?? null,
          updatedAt: new Date(),
        })
        .where(eq(risks.id, existing.id));
      updated += 1;
      if (increased) {
        alertEvents.push({
          riskId: existing.id,
          projectId,
          level,
          previousLevel: existing.level,
          isNew: false,
          severityIncreased: true,
          confidence: item.confidence,
          reason: item.reason,
        });
        outboundEvents.push(
          ...mapRiskAlertToWebhookEvents({
            tenantId,
            riskId: existing.id,
            projectId,
            level,
            previousLevel: existing.level,
            isNew: false,
            severityIncreased: true,
            confidence: item.confidence,
            reason: item.reason,
          }),
        );
      } else {
        outboundEvents.push(
          ...mapRiskAlertToWebhookEvents({
            tenantId,
            riskId: existing.id,
            projectId,
            level,
            previousLevel: existing.level,
            isNew: false,
            severityIncreased: false,
            confidence: item.confidence,
            reason: item.reason,
          }),
        );
      }
    }

    for (const existing of existingRows) {
      if (!existing.ruleKey || activeRuleKeys.has(existing.ruleKey as RiskRuleKey)) continue;
      if (existing.status !== 'open') continue;

      await db
        .update(risks)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(risks.id, existing.id));
      resolved += 1;
      outboundEvents.push({
        eventType: 'risk.resolved',
        tenantId,
        riskId: existing.id,
        projectId,
        level: existing.level,
        confidence: existing.confidence,
        reason: existing.reason,
        status: 'resolved',
      });
    }

    return { created, updated, resolved, alertEvents, outboundEvents };
  });
}

export async function evaluateProjectRisks(
  db: Database,
  tenantId: string,
  projectId: string,
): Promise<{ detected: DetectedRisk[]; composite: ReturnType<typeof aggregateCompositeRisk>; counts: { created: number; updated: number; resolved: number } }> {
  const ctx = await loadProjectEvaluationContext(db, tenantId, projectId);
  if (!ctx) {
    return {
      detected: [],
      composite: null,
      counts: { created: 0, updated: 0, resolved: 0 },
    };
  }

  const detected = shouldExcludeFromActivePortfolio(ctx.project.status)
    ? []
    : evaluateAllRules(ctx);
  const composite = aggregateCompositeRisk(detected);
  const result = await persistProjectRisks(db, tenantId, projectId, detected, ctx.settings);

  if (result.alertEvents.length > 0) {
    const { processImmediateAlerts } = await import('../notifications/digest.js');
    await processImmediateAlerts(db, tenantId, result.alertEvents);
  }

  if (result.outboundEvents.length > 0) {
    const { scheduleOutboundRiskWebhooks } = await import('../webhooks/delivery-service.js');
    scheduleOutboundRiskWebhooks(db, tenantId, result.outboundEvents);
  }

  const { alertEvents: _alertEvents, outboundEvents: _outboundEvents, ...counts } = result;
  return { detected, composite, counts };
}

export async function runRiskEvaluation(
  db: Database,
  tenantId: string,
  trigger: 'scheduled' | 'event' | 'manual' = 'manual',
  projectId?: string,
): Promise<RiskEvaluationResult> {
  const job = await withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .insert(riskEvaluationJobs)
      .values({
        tenantId,
        projectId: projectId ?? null,
        trigger,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();
    return row!;
  });

  try {
    const projectIds = projectId
      ? [projectId]
      : (await listProjectsForBatchEvaluation(db, tenantId)).map((row) => row.id);
    let risksCreated = 0;
    let risksUpdated = 0;
    let risksResolved = 0;
    const allDetected: DetectedRisk[] = [];

    for (const activeProjectId of projectIds) {
      const result = await evaluateProjectRisks(db, tenantId, activeProjectId);
      allDetected.push(...result.detected);
      risksCreated += result.counts.created;
      risksUpdated += result.counts.updated;
      risksResolved += result.counts.resolved;
    }

    await withTenantContext(db, tenantId, async () => {
      await db
        .update(riskEvaluationJobs)
        .set({
          status: 'completed',
          risksCreated,
          risksUpdated,
          risksResolved,
          completedAt: new Date(),
        })
        .where(eq(riskEvaluationJobs.id, job.id));
    });

    const { scheduleInsightGeneration } = await import('../intelligence/engine.js');
    for (const activeProjectId of projectIds) {
      scheduleInsightGeneration(db, tenantId, activeProjectId);
    }

    const { invalidateTenantDashboardCache } = await import('../../lib/dashboard-cache.js');
    await invalidateTenantDashboardCache(tenantId);

    return {
      jobId: job.id,
      risksCreated,
      risksUpdated,
      risksResolved,
      detected: allDetected,
      composite: aggregateCompositeRisk(allDetected),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Risk evaluation failed';
    await withTenantContext(db, tenantId, async () => {
      await db
        .update(riskEvaluationJobs)
        .set({
          status: 'failed',
          error: message,
          completedAt: new Date(),
        })
        .where(eq(riskEvaluationJobs.id, job.id));
    });
    throw error;
  }
}

export async function getLatestRiskEvaluationJob(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(riskEvaluationJobs)
      .where(eq(riskEvaluationJobs.tenantId, tenantId))
      .orderBy(desc(riskEvaluationJobs.createdAt))
      .limit(1);
    return row ?? null;
  });
}

const pendingEvaluations = new Map<string, NodeJS.Timeout>();

export function scheduleRiskEvaluation(
  db: Database,
  tenantId: string,
  projectId?: string,
  delayMs = 2_000,
): void {
  const key = `${tenantId}:${projectId ?? 'all'}`;
  const existing = pendingEvaluations.get(key);
  if (existing) clearTimeout(existing);

  pendingEvaluations.set(
    key,
    setTimeout(() => {
      pendingEvaluations.delete(key);
      void runRiskEvaluation(db, tenantId, 'event', projectId).catch((error) => {
        logger.error('Event-triggered risk evaluation failed', {
          tenantId,
          projectId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }, delayMs),
  );
}

export async function runScheduledRiskEvaluations(db: Database): Promise<void> {
  const tenantIds = await listTenantIds(db);
  for (const tenantId of tenantIds) {
    try {
      await runRiskEvaluation(db, tenantId, 'scheduled');
    } catch (error) {
      logger.error('Scheduled risk evaluation failed', {
        tenantId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function startRiskEvaluation(
  db: Database,
  tenantId: string,
  trigger: 'manual' | 'scheduled' = 'manual',
  projectId?: string,
): void {
  void runRiskEvaluation(db, tenantId, trigger, projectId).catch((error) => {
    logger.error('Background risk evaluation failed', {
      tenantId,
      projectId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}
