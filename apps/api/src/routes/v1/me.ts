import { createDb, users } from '@beacon/db';
import { getTenantId } from '@beacon/shared';
import { SUPPORTED_LOCALES } from '@beacon/shared/i18n';
import { SUPPORTED_CURRENCY_FORMAT_LOCALES } from '@beacon/shared/currency-format';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, notFound, problemResponse } from '../../lib/errors.js';
import { getUserId, requireUser } from '../../middleware/auth.js';
import {
  buildMeResponse,
  updateUserCurrencyFormatLocale,
  updateUserLocale,
} from '../../services/tenant-service.js';

const localeSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
});

const currencyFormatSchema = z.object({
  currencyFormatLocale: z.enum(SUPPORTED_CURRENCY_FORMAT_LOCALES),
});

export const meRoutes = new Hono();

meRoutes.get('/me', requireUser, async (c) => {
  const userId = getUserId(c);
  const { db } = createDb(env.DATABASE_URL);
  const activeTenantId = getTenantId(c.req.raw.headers);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return problemResponse(c, notFound('User not found'));
  }

  const response = await buildMeResponse(db, user, activeTenantId);
  return c.json(response);
});

meRoutes.patch('/me/locale', requireUser, async (c) => {
  const userId = getUserId(c);
  const body = localeSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const activeTenantId = getTenantId(c.req.raw.headers);
  await updateUserLocale(db, userId, body.data.locale);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return problemResponse(c, notFound('User not found'));

  const response = await buildMeResponse(db, user, activeTenantId);
  return c.json(response);
});

meRoutes.patch('/me/currency-format', requireUser, async (c) => {
  const userId = getUserId(c);
  const body = currencyFormatSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const activeTenantId = getTenantId(c.req.raw.headers);
  await updateUserCurrencyFormatLocale(db, userId, body.data.currencyFormatLocale);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return problemResponse(c, notFound('User not found'));

  const response = await buildMeResponse(db, user, activeTenantId);
  return c.json(response);
});
