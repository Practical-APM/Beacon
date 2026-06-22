import { releaseSyncLock } from '../lib/sync-lock.js';
import { invalidateProjectInsightCache } from '../services/intelligence/cache.js';

const SYNC_LOCK_KEYS = (tenantId: string) => [
  `sf-sync:${tenantId}`,
  `slack-sync:${tenantId}`,
  `jira-sync:${tenantId}`,
  `hs-sync:${tenantId}`,
  `dyn-sync:${tenantId}`,
  `google-calendar-sync:${tenantId}`,
];

export async function clearIntegrationSyncLocks(tenantId: string): Promise<void> {
  await Promise.all(SYNC_LOCK_KEYS(tenantId).map((key) => releaseSyncLock(key)));
}

export async function clearProjectInsightCache(
  tenantId: string,
  projectId: string,
): Promise<void> {
  await invalidateProjectInsightCache(tenantId, projectId);
}
