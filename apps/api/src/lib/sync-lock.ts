import { ensureRedisReady, getRedis } from './redis.js';

const LOCK_TTL_SECONDS = 60 * 30;

export async function acquireSyncLock(key: string): Promise<boolean> {
  const redis = await ensureRedisReady();
  const result = await redis.set(`lock:${key}`, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
  return result === 'OK';
}

export async function releaseSyncLock(key: string): Promise<void> {
  const redis = await ensureRedisReady();
  await redis.del(`lock:${key}`);
}

export async function setSyncProgress(key: string, payload: Record<string, unknown>): Promise<void> {
  const redis = await ensureRedisReady();
  await redis.set(`sync-progress:${key}`, JSON.stringify(payload), 'EX', LOCK_TTL_SECONDS);
}

export async function getSyncProgress(key: string): Promise<Record<string, unknown> | null> {
  const redis = await ensureRedisReady();
  const raw = await redis.get(`sync-progress:${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function storeOAuthState(
  state: string,
  payload: Record<string, string>,
  provider = 'salesforce',
): Promise<void> {
  const redis = await ensureRedisReady();
  await redis.set(`oauth:${provider}:${state}`, JSON.stringify(payload), 'EX', 600);
}

export async function consumeOAuthState(
  state: string,
  provider = 'salesforce',
): Promise<Record<string, string> | null> {
  const redis = await ensureRedisReady();
  const key = `oauth:${provider}:${state}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}
