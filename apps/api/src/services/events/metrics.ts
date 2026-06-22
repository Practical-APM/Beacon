import { getRedis } from '../../lib/redis.js';

const METRICS_KEY = 'ingestion:metrics';

export interface IngestionMetrics {
  processed: number;
  deduplicated: number;
  failed: number;
  dlqDepth: number;
  realtimeWaiting: number;
  bulkWaiting: number;
  lastProcessedAt: string | null;
}

async function getRedisClient() {
  const redis = getRedis();
  if (redis.status !== 'ready') {
    await redis.connect();
  }
  return redis;
}

export async function incrementMetric(field: keyof IngestionMetrics, amount = 1): Promise<void> {
  const redis = await getRedisClient();
  if (field === 'lastProcessedAt') {
    await redis.hset(METRICS_KEY, field, new Date().toISOString());
    return;
  }
  if (typeof amount === 'number' && ['processed', 'deduplicated', 'failed'].includes(field)) {
    await redis.hincrby(METRICS_KEY, field, amount);
  }
}

export async function setQueueDepth(
  field: 'dlqDepth' | 'realtimeWaiting' | 'bulkWaiting',
  value: number,
): Promise<void> {
  const redis = await getRedisClient();
  await redis.hset(METRICS_KEY, field, String(value));
}

export async function getIngestionMetrics(): Promise<IngestionMetrics> {
  const redis = await getRedisClient();
  const raw = await redis.hgetall(METRICS_KEY);
  return {
    processed: Number(raw.processed ?? 0),
    deduplicated: Number(raw.deduplicated ?? 0),
    failed: Number(raw.failed ?? 0),
    dlqDepth: Number(raw.dlqDepth ?? 0),
    realtimeWaiting: Number(raw.realtimeWaiting ?? 0),
    bulkWaiting: Number(raw.bulkWaiting ?? 0),
    lastProcessedAt: raw.lastProcessedAt ?? null,
  };
}

export async function resetIngestionMetrics(): Promise<void> {
  const redis = await getRedisClient();
  await redis.del(METRICS_KEY);
}
