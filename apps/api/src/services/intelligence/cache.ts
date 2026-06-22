import {
  INSIGHT_CACHE_TTL_SECONDS,
  insightOutputToGenerated,
  type GeneratedInsight,
} from '@beacon/shared';
import { getRedis } from '../../lib/redis.js';

function cacheKey(tenantId: string, projectId: string, riskId: string, evidenceHash: string): string {
  return `intelligence:insight:${tenantId}:${projectId}:${riskId}:${evidenceHash}`;
}

function usageKey(tenantId: string, day: string): string {
  return `intelligence:usage:${tenantId}:${day}`;
}

export async function getCachedInsight(
  tenantId: string,
  projectId: string,
  riskId: string,
  evidenceHash: string,
): Promise<GeneratedInsight | null> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const raw = await redis.get(cacheKey(tenantId, projectId, riskId, evidenceHash));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeneratedInsight;
    return { ...parsed, source: 'cached' };
  } catch {
    return null;
  }
}

export async function setCachedInsight(
  tenantId: string,
  projectId: string,
  riskId: string,
  insight: GeneratedInsight,
): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    await redis.set(
      cacheKey(tenantId, projectId, riskId, insight.evidenceHash),
      JSON.stringify(insight),
      'EX',
      INSIGHT_CACHE_TTL_SECONDS,
    );
  } catch {
    // Cache failures should not block insight generation.
  }
}

export async function invalidateProjectInsightCache(
  tenantId: string,
  projectId: string,
): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const pattern = `intelligence:insight:${tenantId}:${projectId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // ignore
  }
}

export async function getTenantTokenUsage(tenantId: string, day = new Date().toISOString().slice(0, 10)) {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const raw = await redis.get(usageKey(tenantId, day));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export async function incrementTenantTokenUsage(
  tenantId: string,
  tokensUsed: number,
  day = new Date().toISOString().slice(0, 10),
): Promise<number> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const total = await redis.incrby(usageKey(tenantId, day), tokensUsed);
    await redis.expire(usageKey(tenantId, day), 86_400);
    return total;
  } catch {
    return tokensUsed;
  }
}

export async function isTenantOverTokenCap(
  tenantId: string,
  dailyCap: number,
): Promise<boolean> {
  const usage = await getTenantTokenUsage(tenantId);
  return usage >= dailyCap;
}

export { insightOutputToGenerated };
