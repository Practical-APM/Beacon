import type { SlackMessageSample } from '@beacon/shared';
import type { SlackChannelRecord, SlackCredentials, SlackMessageRecord } from './types.js';

export function createMockSlackCredentials(): SlackCredentials {
  return {
    accessToken: 'xoxp-mock-user-token',
    botAccessToken: 'xoxb-mock-bot-token',
    teamId: 'T-MOCK-ACME',
    teamName: 'Acme Demo Workspace',
    botUserId: 'B-MOCK-BOT',
    scope: 'channels:history,channels:read,groups:history,groups:read,users:read,users:read.email,chat:write',
  };
}

export function getMockSlackChannels(): SlackChannelRecord[] {
  return [
    { id: 'C001', name: 'acme-implementation', isPrivate: false, isMember: true },
    { id: 'C002', name: 'acme-security-review', isPrivate: false, isMember: true },
    { id: 'C003', name: 'acme-executive-updates', isPrivate: false, isMember: true },
    { id: 'C004', name: 'private-onboarding', isPrivate: true, isMember: false },
  ];
}

export function getMockSlackUsers(): Record<string, { email: string; isBot?: boolean }> {
  return {
    U001: { email: 'buyer@customer.com' },
    U002: { email: 'alex.rivera@acme-demo.test' },
    U003: { email: 'jamie.chen@acme-demo.test' },
    U004: { email: 'exec@acme-demo.test' },
    'B-MOCK-BOT': { email: 'bot@acme-demo.test', isBot: true },
  };
}

function daysAgoTs(days: number): string {
  return `${Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)}.000001`;
}

export function getMockSlackMessages(channelId: string): SlackMessageRecord[] {
  const users = getMockSlackUsers();

  if (channelId === 'C001') {
    return [
      { ts: daysAgoTs(30), user: 'U001', text: 'Sharing security questionnaire responses' },
      { ts: daysAgoTs(16), user: 'U002', text: 'Following up on the security review items' },
      { ts: daysAgoTs(15), user: 'U002', text: 'Can you confirm timeline for legal review?' },
    ];
  }

  if (channelId === 'C002') {
    return [
      { ts: daysAgoTs(20), user: 'U001', text: 'Uploaded SOC2 docs' },
      { ts: daysAgoTs(18), user: 'U003', text: 'Reviewing uploaded evidence' },
    ];
  }

  if (channelId === 'C003') {
    return [
      {
        ts: daysAgoTs(2),
        user: 'U002',
        text: 'Need escalation on blocked rollout @exec',
      },
      { ts: daysAgoTs(1), user: 'U004', text: 'Acknowledged, reviewing blockers' },
    ];
  }

  if (channelId === 'C004') {
    return [{ ts: daysAgoTs(5), user: 'U001', text: 'Private onboarding question' }];
  }

  return [];
}

export function toMessageSamples(channelId: string): SlackMessageSample[] {
  const users = getMockSlackUsers();
  return getMockSlackMessages(channelId).map((message) => {
    const profile = users[message.user];
    return {
      ts: message.ts,
      userId: message.user,
      userEmail: profile?.email ?? null,
      isBot: profile?.isBot ?? false,
      threadTs: message.thread_ts ?? null,
      textPreview: message.text,
      mentionsExec: Boolean(message.text?.includes('@exec')),
    };
  });
}

export const DEFAULT_MOCK_CHANNEL_MAPPINGS = [
  { channelId: 'C001', channelName: 'acme-implementation' },
  { channelId: 'C002', channelName: 'acme-security-review' },
  { channelId: 'C003', channelName: 'acme-executive-updates' },
] as const;
