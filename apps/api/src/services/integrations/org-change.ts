import { tenantMemberships, users, type Database } from '@beacon/db';
import { and, eq, isNull } from 'drizzle-orm';
import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';
import { deliverChannels } from '../notifications/delivery.js';

export function detectExternalOrgChange(params: {
  previousOrgId: string | null | undefined;
  nextOrgId: string;
  wasConnected: boolean;
}): { changed: boolean; previousOrgId: string | null } {
  const previousOrgId = params.previousOrgId ?? null;
  if (!params.wasConnected || !previousOrgId || previousOrgId === params.nextOrgId) {
    return { changed: false, previousOrgId };
  }
  return { changed: true, previousOrgId };
}

export async function notifyAdminsIntegrationOrgChange(
  db: Database,
  tenantId: string,
  params: {
    source: string;
    sourceLabel: string;
    previousOrgId: string;
    newOrgId: string;
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
    logger.warn('No admins to notify for integration org change', {
      tenantId,
      source: params.source,
    });
    return;
  }

  const integrationsUrl = `${env.WEB_APP_URL}/integrations`;
  const title = `${params.sourceLabel} org changed`;
  const body = `A different ${params.sourceLabel} org was connected (${params.previousOrgId} → ${params.newOrgId}). Review field mappings and project links.`;
  const text = `${title}\n\n${body}\n\nReview integrations: ${integrationsUrl}`;
  const html = `<p><strong>${title}</strong></p><p>${body}</p><p><a href="${integrationsUrl}">Review integrations</a></p>`;
  const dedupeKey = `integration-org-change:${params.source}:${params.newOrgId}`;

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
          previousOrgId: params.previousOrgId,
          newOrgId: params.newOrgId,
        },
      },
      ['in_app', 'email'],
    );
  }

  logger.info('Notified admins of integration org change', {
    tenantId,
    source: params.source,
    previousOrgId: params.previousOrgId,
    newOrgId: params.newOrgId,
    adminCount: admins.length,
  });
}
