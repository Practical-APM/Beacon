import { tenantMemberships, users, type Database } from '@beacon/db';
import { and, eq, isNull } from 'drizzle-orm';
import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';
import { deliverChannels } from '../notifications/delivery.js';

export async function notifyAdminsInitialSyncComplete(
  db: Database,
  tenantId: string,
  params: {
    source: string;
    sourceLabel: string;
    recordsProcessed: number;
  },
): Promise<void> {
  const admins = await db
    .select({
      userId: tenantMemberships.userId,
      email: users.email,
      emailValid: users.emailValid,
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
    logger.warn('No admins to notify for initial sync completion', {
      tenantId,
      source: params.source,
    });
    return;
  }

  const dashboardUrl = `${env.WEB_APP_URL}/dashboard`;
  const title = `${params.sourceLabel} import complete`;
  const body = `Imported ${params.recordsProcessed} record${params.recordsProcessed === 1 ? '' : 's'}. Your portfolio dashboard is ready to review.`;
  const text = `${title}\n\n${body}\n\nOpen dashboard: ${dashboardUrl}`;
  const html = `<p><strong>${title}</strong></p><p>${body}</p><p><a href="${dashboardUrl}">Open dashboard</a></p>`;
  const dedupeKey = `initial-sync:${params.source}:${tenantId}`;

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
        subject: title,
        text,
        html,
        title,
        body,
        metadata: {
          source: params.source,
          recordsProcessed: params.recordsProcessed,
        },
      },
      ['in_app', 'email'],
    );
  }

  logger.info('Notified admins of initial sync completion', {
    tenantId,
    source: params.source,
    adminCount: admins.length,
    recordsProcessed: params.recordsProcessed,
  });
}
