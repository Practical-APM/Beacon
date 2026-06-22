import type { Context, Next } from 'hono';
import { getRedis } from '../lib/redis.js';
import { ApiError, problemResponse } from '../lib/errors.js';

const DEFAULT_LIMIT = 100;
const WINDOW_SECONDS = 60;

function rateLimitKey(tenantId: string, windowStart: number): string {
  return `ratelimit:tenant:${tenantId}:${windowStart}`;
}

export async function tenantRateLimit(c: Context, next: Next): Promise<Response | void> {
  if (!c.req.path.startsWith('/v1')) {
    await next();
    return;
  }

  if (c.req.path === '/health' || c.req.path === '/ready' || c.req.path.endsWith('/openapi.json') || c.req.path === '/v1/notifications/unsubscribe' || c.req.path === '/v1/legal/dpa') {
    await next();
    return;
  }

  const tenantId = c.get('tenantId') as string | undefined;
  if (!tenantId) {
    await next();
    return;
  }

  const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS;
  const key = rateLimitKey(tenantId, windowStart);

  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    const remaining = Math.max(0, DEFAULT_LIMIT - count);
    c.header('X-RateLimit-Limit', String(DEFAULT_LIMIT));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(windowStart + WINDOW_SECONDS));

    if (count > DEFAULT_LIMIT) {
      const retryAfter = windowStart + WINDOW_SECONDS - Math.floor(Date.now() / 1000);
      c.header('Retry-After', String(Math.max(1, retryAfter)));
      return problemResponse(
        c,
        new ApiError(429, 'Too Many Requests', 'Tenant rate limit exceeded. Try again later.'),
      );
    }
  } catch {
    await next();
    return;
  }

  await next();
}
