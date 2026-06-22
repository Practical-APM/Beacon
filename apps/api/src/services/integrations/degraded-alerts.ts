import { tenantMemberships, users, type Database } from '@beacon/db';
import { localDateKey } from '@beacon/shared/notifications';
import { and, eq, isNull } from 'drizzle-orm';
import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';
import { deliverChannels } from '../notifications/delivery.js';
import {
  buildIntegrationAuthAlertContent,
  isAuthRelatedIntegrationError,
} from './auth-errors.js';

export async function notifyAdminsIntegrationAuthFailure(
  db: Database,
  tenantId: string,
  source: string,
  errorMessage: string,
): Promise<void> {
  if (!isAuthRelatedIntegrationError(errorMessage)) return;

  const admins = await db
    .select({
      userId: tenantMemberships.userId,
      email: users.email,
      emailValid: users.emailValid,
      timezone: users.timezone,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(tenantMemberships.userId, users.id))
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.role, 'admin'),
        isNull(tenantMemberships.deletedAt),
      ),
    );

  if (admins.length === 0) {
    logger.warn('No admins to notify for integration auth failure', { tenantId, source });
    return;
  }

  const integrationsUrl = `${env.WEB_APP_URL}/integrations`;
  const content = buildIntegrationAuthAlertContent({
    source,
    errorMessage,
    integrationsUrl,
  });
  const dateKey = localDateKey('UTC');
  const dedupeKey = `integration-auth:${source}:${dateKey}`;

  for (const admin of admins) {
    await deliverChannels(
      db,
      {
        tenantId,
        userId: admin.userId,
        channel: 'in_app',
        notificationType: 'system',
        dedupeKey: `${dedupeKey}:${admin.userId}`,
        toEmail: admin.emailValid ? admin.email : undefined,
        subject: content.subject,
        text: content.text,
        html: content.html,
        title: content.title,
        body: content.body,
        metadata: { source, errorMessage },
      },
      ['in_app', 'email'],
    );
  }

  logger.info('Notified admins of integration auth failure', {
    tenantId,
    source,
    adminCount: admins.length,
  });
}
