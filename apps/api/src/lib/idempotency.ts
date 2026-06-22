import { idempotencyKeys, withTenantContext, type Database } from '@beacon/db';
import { IDEMPOTENCY_KEY_HEADER } from '@beacon/shared';
import { and, eq, gt } from 'drizzle-orm';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { badRequest, problemResponse } from './errors.js';

export async function getCachedIdempotentResponse(
  db: Database,
  tenantId: string,
  key: string,
): Promise<{ status: number; body: unknown } | null> {
  const existing = await withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenantId, tenantId),
          eq(idempotencyKeys.key, key),
          gt(idempotencyKeys.expiresAt, new Date()),
        ),
      )
      .limit(1),
  );

  if (!existing[0]) return null;
  const body = existing[0].responseBody.body ?? existing[0].responseBody;
  return { status: existing[0].responseStatus, body };
}

export async function storeIdempotentResponse(
  db: Database,
  tenantId: string,
  params: {
    key: string;
    method: string;
    path: string;
    status: number;
    body: unknown;
  },
): Promise<void> {
  await withTenantContext(db, tenantId, async () => {
    await db.insert(idempotencyKeys).values({
      tenantId,
      key: params.key,
      method: params.method,
      path: params.path,
      responseStatus: params.status,
      responseBody: { body: params.body },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });
}

export async function withIdempotency(
  c: Context,
  db: Database,
  tenantId: string,
  handler: () => Promise<{ status: ContentfulStatusCode; body: unknown }>,
): Promise<Response> {
  const key = c.req.header(IDEMPOTENCY_KEY_HEADER);
  if (!key) {
    const result = await handler();
    return c.json(result.body, result.status);
  }

  if (key.length < 8 || key.length > 128) {
    return problemResponse(c, badRequest('Idempotency-Key must be between 8 and 128 characters'));
  }

  const cached = await getCachedIdempotentResponse(db, tenantId, key);
  if (cached) {
    return c.json(cached.body, cached.status as ContentfulStatusCode);
  }

  const result = await handler();
  try {
    await storeIdempotentResponse(db, tenantId, {
      key,
      method: c.req.method,
      path: c.req.path,
      status: result.status,
      body: result.body,
    });
  } catch {
    // Concurrent duplicate — return fresh result anyway.
  }

  return c.json(result.body, result.status);
}
