import { Redis } from 'ioredis';
import { env } from '../env.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function ensureRedisReady(): Promise<Redis> {
  const client = getRedis();
  if (client.status === 'ready') return client;
  if (client.status === 'connecting') {
    await new Promise<void>((resolve, reject) => {
      client.once('ready', () => resolve());
      client.once('error', (error) => reject(error));
    });
    return client;
  }
  await client.connect();
  return client;
}

export async function checkRedisHealth(): Promise<'ok' | 'error'> {
  try {
    const client = await ensureRedisReady();
    const pong = await client.ping();
    return pong === 'PONG' ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
