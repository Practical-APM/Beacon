import { checkDatabaseHealth } from '@beacon/db';
import type { HealthResponse, ReadyResponse } from '@beacon/shared';
import { Hono } from 'hono';
import { env } from '../env.js';
import { checkRedisHealth } from '../lib/redis.js';

const VERSION = '0.1.0';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'beacon-api',
    version: VERSION,
    timestamp: new Date().toISOString(),
  };
  return c.json(body);
});

healthRoutes.get('/ready', async (c) => {
  const [database, redis] = await Promise.all([
    checkDatabaseHealth(env.DATABASE_URL),
    checkRedisHealth(),
  ]);

  const healthy = database === 'ok' && redis === 'ok';
  const body: ReadyResponse = {
    status: healthy ? 'ok' : 'degraded',
    service: 'beacon-api',
    version: VERSION,
    timestamp: new Date().toISOString(),
    checks: {
      database,
      redis,
    },
  };

  return c.json(body, healthy ? 200 : 503);
});
