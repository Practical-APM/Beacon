import {
  projectInsights,
  projects,
  recommendations,
  risks,
  tenants,
  withTenantContext,
  type Database,
} from '@beacon/db';
import {
  INSIGHT_LLM_TIMEOUT_MS,
  buildTemplateInsight,
  insightOutputToGenerated,
  mergeIntelligenceSettings,
  prepareEvidenceBundle,
  sanitizePromptField,
  type GeneratedInsight,
  type IntelligenceSettings,
} from '@beacon/shared';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';
import { mockIntegrationAllowed } from '../../lib/mock-integration.js';
import {
  getCachedInsight,
  incrementTenantTokenUsage,
  isTenantOverTokenCap,
  setCachedInsight,
} from './cache.js';
import { createLlmProvider } from './providers/index.js';
import { isLlmEnabled } from '../feature-flags.js';

export interface PersistedInsight extends GeneratedInsight {
  id: string;
  projectId: string;
  riskId: string | null;
}

function resolveProvider(settings: ReturnType<typeof mergeIntelligenceSettings>) {
  if (settings.provider === 'mock') {
    if (!mockIntegrationAllowed()) {
      return null;
    }
    return createLlmProvider('mock');
  }

  if (!env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY) {
    return mockIntegrationAllowed() ? createLlmProvider('mock') : null;
  }
  if (settings.provider === 'anthropic' && env.ANTHROPIC_API_KEY) {
    return createLlmProvider('anthropic');
  }
  if (settings.provider === 'openai' && env.OPENAI_API_KEY) {
    return createLlmProvider('openai');
  }
  if (env.OPENAI_API_KEY) return createLlmProvider('openai');
  if (env.ANTHROPIC_API_KEY) return createLlmProvider('anthropic');
  return mockIntegrationAllowed() ? createLlmProvider('mock') : null;
}

async function loadIntelligenceSettings(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    return mergeIntelligenceSettings((tenant?.intelligenceSettings ?? {}) as IntelligenceSettings);
  });
}

export async function updateIntelligenceSettings(
  db: Database,
  tenantId: string,
  patch: IntelligenceSettings,
) {
  const sanitizedPatch = { ...patch };
  if (sanitizedPatch.provider === 'mock' && !mockIntegrationAllowed()) {
    delete sanitizedPatch.provider;
  }

  return withTenantContext(db, tenantId, async () => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const current = (tenant?.intelligenceSettings ?? {}) as IntelligenceSettings;
    const next = { ...current, ...sanitizedPatch };
    await db
      .update(tenants)
      .set({ intelligenceSettings: next, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    return mergeIntelligenceSettings(next);
  });
}

async function persistInsight(
  db: Database,
  tenantId: string,
  projectId: string,
  riskId: string,
  insight: GeneratedInsight,
): Promise<PersistedInsight> {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(projectInsights)
      .where(
        and(
          eq(projectInsights.tenantId, tenantId),
          eq(projectInsights.riskId, riskId),
          isNull(projectInsights.deletedAt),
        ),
      )
      .limit(1);

    const values = {
      projectId,
      riskId,
      rootCause: insight.rootCause,
      recommendedAction: insight.recommendedAction,
      suggestedOwner: insight.suggestedOwner,
      escalationPath: insight.escalationPath,
      confidence: insight.confidence,
      evidence: insight.evidence as unknown as Record<string, unknown>[],
      evidenceHash: insight.evidenceHash,
      source: insight.source,
      locale: insight.locale,
      tokensUsed: insight.tokensUsed ?? null,
      updatedAt: new Date(),
    };

    let row;
    if (existing) {
      [row] = await db
        .update(projectInsights)
        .set(values)
        .where(eq(projectInsights.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(projectInsights)
        .values({ tenantId, ...values })
        .returning();
    }

    const [existingRecommendation] = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.riskId, riskId),
          isNull(recommendations.deletedAt),
        ),
      )
      .limit(1);

    if (existingRecommendation) {
      await db
        .update(recommendations)
        .set({
          suggestedOwner: insight.suggestedOwner,
          suggestedAction: insight.recommendedAction,
          escalationPath: insight.escalationPath,
          updatedAt: new Date(),
        })
        .where(eq(recommendations.id, existingRecommendation.id));
    } else {
      await db.insert(recommendations).values({
        tenantId,
        projectId,
        riskId,
        suggestedOwner: insight.suggestedOwner,
        suggestedAction: insight.recommendedAction,
        escalationPath: insight.escalationPath,
        status: 'pending',
      });
    }

    return {
      id: row!.id,
      projectId,
      riskId,
      ...insight,
    };
  });
}

export async function generateInsightForRisk(
  db: Database,
  tenantId: string,
  riskId: string,
): Promise<PersistedInsight | null> {
  const settings = await loadIntelligenceSettings(db, tenantId);

  const context = await withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select({ risk: risks, project: projects })
      .from(risks)
      .innerJoin(projects, eq(risks.projectId, projects.id))
      .where(and(eq(risks.id, riskId), eq(risks.tenantId, tenantId), isNull(risks.deletedAt)))
      .limit(1);
    return row ?? null;
  });

  if (!context || context.risk.status === 'resolved') return null;

  const rawEvidence = (context.risk.evidence as Record<string, unknown>[] | null) ?? [];
  if (rawEvidence.length === 0) {
    logger.error('Skipping insight generation for risk without evidence', { tenantId, riskId });
    return null;
  }

  const bundle = prepareEvidenceBundle(rawEvidence);
  const cached = await getCachedInsight(
    tenantId,
    context.project.id,
    riskId,
    bundle.hash,
  );
  if (cached) {
    return persistInsight(db, tenantId, context.project.id, riskId, cached);
  }

  const safeProjectName = sanitizePromptField(context.project.name);
  const safeRiskReason = sanitizePromptField(context.risk.reason);
  const safeProjectOwner = context.project.ownerName
    ? sanitizePromptField(context.project.ownerName)
    : null;

  let insight: GeneratedInsight;
  const featureFlagsEnabled = await isLlmEnabled(db, tenantId);
  const useLlm =
    featureFlagsEnabled &&
    settings.llmEnabled &&
    !(await isTenantOverTokenCap(tenantId, settings.dailyTokenCap));

  if (useLlm) {
    const provider = resolveProvider(settings);
    if (provider) {
      try {
        const result = await provider.generateInsight({
          prompt: '',
          maxTokens: settings.maxTokensPerRequest,
          locale: settings.locale,
          timeoutMs: INSIGHT_LLM_TIMEOUT_MS,
          evidence: bundle.items,
          projectName: safeProjectName,
          riskReason: safeRiskReason,
          riskLevel: context.risk.level,
        });
        insight = insightOutputToGenerated(
          result.output,
          bundle,
          'llm',
          settings.locale,
          result.tokensUsed,
        );
        await incrementTenantTokenUsage(tenantId, result.tokensUsed);
      } catch (error) {
        logger.warn('LLM insight generation failed; using template fallback', {
          tenantId,
          riskId,
          message: error instanceof Error ? error.message : String(error),
        });
        insight = buildTemplateInsight({
          riskReason: safeRiskReason,
          ruleKey: context.risk.ruleKey,
          evidence: bundle.items,
          bundle,
          locale: settings.locale,
          projectOwner: safeProjectOwner,
        });
      }
    } else {
      insight = buildTemplateInsight({
        riskReason: safeRiskReason,
        ruleKey: context.risk.ruleKey,
        evidence: bundle.items,
        bundle,
        locale: settings.locale,
        projectOwner: safeProjectOwner,
      });
    }
  } else {
    insight = buildTemplateInsight({
      riskReason: safeRiskReason,
      ruleKey: context.risk.ruleKey,
      evidence: bundle.items,
      bundle,
      locale: settings.locale,
      projectOwner: safeProjectOwner,
    });
  }

  await setCachedInsight(tenantId, context.project.id, riskId, insight);
  return persistInsight(db, tenantId, context.project.id, riskId, insight);
}

export async function generateProjectInsights(
  db: Database,
  tenantId: string,
  projectId: string,
  riskId?: string,
): Promise<PersistedInsight[]> {
  const openRisks = await withTenantContext(db, tenantId, async () => {
    return db
      .select({ id: risks.id })
      .from(risks)
      .where(
        and(
          eq(risks.tenantId, tenantId),
          eq(risks.projectId, projectId),
          isNull(risks.deletedAt),
          inArray(risks.status, ['open', 'acknowledged', 'snoozed']),
          riskId ? eq(risks.id, riskId) : undefined,
        ),
      );
  });

  const results: PersistedInsight[] = [];
  for (const risk of openRisks) {
    const insight = await generateInsightForRisk(db, tenantId, risk.id);
    if (insight) results.push(insight);
  }
  return results;
}

export async function getInsightByRiskId(db: Database, tenantId: string, riskId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(projectInsights)
      .where(
        and(
          eq(projectInsights.tenantId, tenantId),
          eq(projectInsights.riskId, riskId),
          isNull(projectInsights.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  });
}

export async function listProjectInsights(db: Database, tenantId: string, projectId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(projectInsights)
      .where(
        and(
          eq(projectInsights.tenantId, tenantId),
          eq(projectInsights.projectId, projectId),
          isNull(projectInsights.deletedAt),
        ),
      )
      .orderBy(desc(projectInsights.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      riskId: row.riskId,
      rootCause: row.rootCause,
      recommendedAction: row.recommendedAction,
      suggestedOwner: row.suggestedOwner,
      escalationPath: row.escalationPath,
      confidence: row.confidence,
      evidence: row.evidence,
      evidenceHash: row.evidenceHash,
      source: row.source,
      locale: row.locale,
      tokensUsed: row.tokensUsed,
      updatedAt: row.updatedAt,
    }));
  });
}

const pendingGenerations = new Map<string, NodeJS.Timeout>();

export function scheduleInsightGeneration(
  db: Database,
  tenantId: string,
  projectId: string,
  delayMs = 3_000,
): void {
  const key = `${tenantId}:${projectId}`;
  const existing = pendingGenerations.get(key);
  if (existing) clearTimeout(existing);

  pendingGenerations.set(
    key,
    setTimeout(() => {
      pendingGenerations.delete(key);
      void generateProjectInsights(db, tenantId, projectId).catch((error) => {
        logger.error('Background insight generation failed', {
          tenantId,
          projectId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }, delayMs),
  );
}

export async function getIntelligenceStatus(db: Database, tenantId: string) {
  const settings = await loadIntelligenceSettings(db, tenantId);
  const usage = await import('./cache.js').then((mod) => mod.getTenantTokenUsage(tenantId));
  return {
    settings,
    usage: {
      tokensToday: usage,
      dailyTokenCap: settings.dailyTokenCap,
      remaining: Math.max(0, settings.dailyTokenCap - usage),
    },
    providers: {
      openaiConfigured: Boolean(env.OPENAI_API_KEY),
      anthropicConfigured: Boolean(env.ANTHROPIC_API_KEY),
    },
  };
}
