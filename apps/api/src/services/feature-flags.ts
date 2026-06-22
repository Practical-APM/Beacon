import { tenants, withTenantContext, type Database } from '@beacon/db';
import { mergeFeatureFlags, resolveFeatureFlags, type TenantFeatureFlags } from '@beacon/shared/feature-flags';
import { eq } from 'drizzle-orm';
import { env } from '../env.js';

export async function getResolvedFeatureFlags(db: Database, tenantId: string) {
  const raw = await withTenantContext(db, tenantId, async () => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    return mergeFeatureFlags((tenant?.featureFlags ?? {}) as TenantFeatureFlags);
  });

  return resolveFeatureFlags(
    {
      FEATURE_LLM_ENABLED: env.FEATURE_LLM_ENABLED,
      FEATURE_SLACK_ALERTS_ENABLED: env.FEATURE_SLACK_ALERTS_ENABLED,
      FEATURE_OUTBOUND_WEBHOOKS_ENABLED: env.FEATURE_OUTBOUND_WEBHOOKS_ENABLED,
      FEATURE_BENCHMARKS_ENABLED: env.FEATURE_BENCHMARKS_ENABLED,
      FEATURE_DELAY_PREDICTIONS_ENABLED: env.FEATURE_DELAY_PREDICTIONS_ENABLED,
    },
    raw,
  );
}

export async function isLlmEnabled(db: Database, tenantId: string): Promise<boolean> {
  const flags = await getResolvedFeatureFlags(db, tenantId);
  return flags.llmEnabled;
}

export async function isSlackAlertsEnabled(db: Database, tenantId: string): Promise<boolean> {
  const flags = await getResolvedFeatureFlags(db, tenantId);
  return flags.slackAlertsEnabled;
}

export async function isBenchmarksEnabled(db: Database, tenantId: string): Promise<boolean> {
  const flags = await getResolvedFeatureFlags(db, tenantId);
  return flags.benchmarkParticipationEnabled;
}
