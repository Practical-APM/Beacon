import type { SlackIntegrationMetadata, SlackMessageSample } from '@beacon/shared';
import { computeSlackChannelSignals, slackTsToIso } from '@beacon/shared';
import type { SlackChannelRecord } from './types.js';
import { SlackClient } from './client.js';
import type { SlackCredentials } from './types.js';

export async function buildChannelMessageSamples(
  client: SlackClient,
  channelId: string,
  limit = 100,
): Promise<SlackMessageSample[]> {
  const messages = await client.listMessages(channelId, limit);
  const samples: SlackMessageSample[] = [];

  for (const message of messages) {
    if (!message.user || !message.ts) continue;
    const email = await client.lookupUserEmail(message.user);
    samples.push({
      ts: message.ts,
      userId: message.user,
      userEmail: email,
      isBot: false,
      threadTs: message.thread_ts ?? null,
      textPreview: message.text,
      mentionsExec: Boolean(message.text?.includes('@exec') || message.text?.includes('<@U')),
    });
  }

  return samples;
}

export function deriveChannelAccess(channel: SlackChannelRecord): {
  botPresent: boolean;
  botAccessError: string | null;
} {
  if (channel.isMember) {
    return { botPresent: true, botAccessError: null };
  }
  return {
    botPresent: false,
    botAccessError: channel.isPrivate ? 'not_in_private_channel' : 'not_in_channel',
  };
}

export async function computeSignalsForChannel(params: {
  client: SlackClient;
  channel: SlackChannelRecord;
  metadata: SlackIntegrationMetadata;
  domainOverrides?: string[];
}) {
  const access = deriveChannelAccess(params.channel);
  if (!access.botPresent) {
    return {
      ...computeSlackChannelSignals({
        messages: [],
        internalDomains: params.metadata.internalDomains,
        customerDomains: params.metadata.customerDomains,
        domainOverrides: params.domainOverrides,
        botPresent: false,
        botAccessError: access.botAccessError,
      }),
      channelId: params.channel.id,
      channelName: params.channel.name,
    };
  }

  const messages = await buildChannelMessageSamples(params.client, params.channel.id);
  const computed = computeSlackChannelSignals({
    messages,
    internalDomains: params.metadata.internalDomains,
    customerDomains: params.metadata.customerDomains,
    domainOverrides: params.domainOverrides,
    botPresent: true,
    botAccessError: null,
  });

  return {
    ...computed,
    channelId: params.channel.id,
    channelName: params.channel.name,
  };
}

export function signalsToDates(signals: ReturnType<typeof computeSlackChannelSignals>) {
  return {
    lastCustomerMessageAt: signals.lastCustomerMessageAt ? new Date(signals.lastCustomerMessageAt) : null,
    lastInternalResponseAt: signals.lastInternalResponseAt
      ? new Date(signals.lastInternalResponseAt)
      : null,
    lastActivityAt: signals.lastActivityAt ? new Date(signals.lastActivityAt) : null,
    lastEscalationAt: signals.lastEscalationAt ? new Date(signals.lastEscalationAt) : null,
  };
}

export function messageSampleToEventPayload(
  channelId: string,
  sample: SlackMessageSample,
): Record<string, unknown> {
  return {
    channelId,
    messageTs: sample.ts,
    userId: sample.userId,
    participantType: sample.userEmail?.split('@')[1] ?? 'unknown',
    threadTs: sample.threadTs ?? null,
    escalation: Boolean(sample.mentionsExec && sample.textPreview?.toLowerCase().includes('escalation')),
    previewRedacted: true,
  };
}

export function webhookMessageToSample(event: {
  ts?: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  userEmail?: string | null;
}): SlackMessageSample | null {
  if (!event.ts || !event.user) return null;
  return {
    ts: event.ts,
    userId: event.user,
    userEmail: event.userEmail ?? null,
    threadTs: event.thread_ts ?? null,
    textPreview: undefined,
    mentionsExec: Boolean(event.text?.includes('@exec')),
  };
}

export function isoFromSlackTs(ts: string): string {
  return slackTsToIso(ts);
}

export function createSlackClient(credentials: SlackCredentials): SlackClient {
  return new SlackClient(credentials);
}
