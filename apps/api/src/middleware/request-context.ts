import { getOrCreateRequestId, getTenantId, REQUEST_ID_HEADER, TENANT_ID_HEADER, IDEMPOTENCY_KEY_HEADER } from '@beacon/shared';
import type { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

export async function requestContext(c: Context, next: Next): Promise<void> {
  const requestId = getOrCreateRequestId(c.req.raw.headers);
  const tenantId = getTenantId(c.req.raw.headers);

  c.set('requestId', requestId);
  c.set('tenantId', tenantId);

  c.header(REQUEST_ID_HEADER, requestId);
  if (tenantId) {
    c.header(TENANT_ID_HEADER, tenantId);
  }

  const start = Date.now();
  await next();
  const durationMs = Date.now() - start;

  logger.info('request completed', {
    requestId,
    tenantId: tenantId ?? undefined,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs,
  });
}

export async function corsMiddleware(c: Context, next: Next): Promise<Response | void> {
  const origin = c.req.header('Origin');
  const { env } = await import('../env.js');

  if (origin === env.CORS_ORIGIN) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header(
      'Access-Control-Allow-Headers',
      `Content-Type, Authorization, ${REQUEST_ID_HEADER}, ${TENANT_ID_HEADER}, ${IDEMPOTENCY_KEY_HEADER}`,
    );
    c.header('Access-Control-Expose-Headers', `${REQUEST_ID_HEADER}, ${TENANT_ID_HEADER}`);
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
}

export async function errorHandler(err: Error, c: Context): Promise<Response> {
  const requestId = c.get('requestId') as string | undefined;

  logger.error(err.message, {
    requestId,
    stack: err.stack,
    path: c.req.path,
  });

  return c.json(
    {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
      requestId,
    },
    500,
  );
}
