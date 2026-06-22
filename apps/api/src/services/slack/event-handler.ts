import type { Database } from '@beacon/db';
import { computeSlackChannelSignals, slackTsToIso } from '@beacon/shared';
import type { CanonicalEvent } from '@beacon/shared/events';
import {
  getSlackChannelMappingByChannelId,
  readSlackMetadata,
  upsertSlackChannelSignal,
} from './integration-service.js';
import { webhookMessageToSample } from './signals.js';

export async function applySlackMessageSideEffect(
  db: Database,
  event: CanonicalEvent,
): Promise<void> {
  if (event.eventType !== 'slack_message') return;

  const channelId = String(event.payload.channelId ?? event.externalId?.split(':')[0] ?? '');
  if (!channelId) return;

  const mappingRow = await getSlackChannelMappingByChannelId(db, event.tenantId, channelId);
  if (!mappingRow?.mapping) return;

  const integration = await import('./integration-service.js').then((mod) =>
    mod.getSlackIntegration(db, event.tenantId),
  );
  if (!integration) return;

  const metadata = readSlackMetadata(integration);
  const sample = webhookMessageToSample({
    ts: String(event.payload.messageTs ?? event.externalId?.split(':')[1] ?? ''),
    user: String(event.payload.userId ?? ''),
    text: typeof event.payload.preview === 'string' ? event.payload.preview : undefined,
    thread_ts: typeof event.payload.threadTs === 'string' ? event.payload.threadTs : undefined,
    userEmail: typeof event.payload.userEmail === 'string' ? event.payload.userEmail : null,
  });
  if (!sample) return;

  const existing = mappingRow.signal;
  const previousMessages = existing
    ? [
        {
          ts: existing.lastActivityAt
            ? `${Math.floor(existing.lastActivityAt.getTime() / 1000)}.000001`
            : sample.ts,
          userId: 'historical',
          userEmail: existing.lastCustomerMessageAt ? 'buyer@customer.com' : 'team@acme-demo.test',
        },
      ]
    : [];

  const computed = computeSlackChannelSignals({
    messages: [...previousMessages, sample],
    internalDomains: metadata.internalDomains,
    customerDomains: metadata.customerDomains,
    domainOverrides: Array.isArray(mappingRow.mapping.metadata?.domainOverrides)
      ? (mappingRow.mapping.metadata.domainOverrides as string[])
      : [],
    botPresent: existing?.botPresent ?? true,
    botAccessError: existing?.botAccessError ?? null,
  });

  await upsertSlackChannelSignal(db, event.tenantId, {
    integrationId: integration.id,
    mappingId: mappingRow.mapping.id,
    projectId: mappingRow.mapping.internalId,
    channelId,
    channelName: String(mappingRow.mapping.metadata?.channelName ?? channelId),
    botPresent: computed.botPresent,
    botAccessError: computed.botAccessError,
    lastCustomerMessageAt: computed.lastCustomerMessageAt
      ? new Date(computed.lastCustomerMessageAt)
      : null,
    lastInternalResponseAt: computed.lastInternalResponseAt
      ? new Date(computed.lastInternalResponseAt)
      : null,
    lastActivityAt: new Date(slackTsToIso(sample.ts)),
    lastEscalationAt: computed.lastEscalationAt ? new Date(computed.lastEscalationAt) : null,
    messageSampleCount: (existing?.messageSampleCount ?? 0) + 1,
    stale: false,
  });
}
