import { getRedis } from './redis.js';

export const DASHBOARD_CACHE_TTL_SECONDS = 60 as const;

function dashboardCachePattern(tenantId: string): string {
  return `dashboard:*:${tenantId}:*`;
}

export function dashboardCacheKey(tenantId: string, scopeKey: string): string {
  return `dashboard:summary:${tenantId}:${scopeKey}`;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Cache failures should not block responses.
  }
}

export async function invalidateTenantDashboardCache(tenantId: string): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const keys = await redis.keys(dashboardCachePattern(tenantId));
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // ignore
  }
}

export function buildDashboardScopeKey(auth: { role: string; email: string }): string {
  if (auth.role === 'contributor') {
    return `contributor:${auth.email.toLowerCase()}`;
  }
  return auth.role;
}
