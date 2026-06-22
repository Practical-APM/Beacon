export const SLACK_BOT_SCOPES = [
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'users:read',
  'users:read.email',
  'chat:write',
] as const;

export const SLACK_USER_SCOPES = ['identity.basic', 'identity.email'] as const;

export const SLACK_ESCALATION_KEYWORDS = ['escalation', 'escalate', 'executive review', 'urgent review'] as const;

export interface SlackIntegrationMetadata {
  teamId: string;
  teamName: string;
  botUserId: string;
  internalDomains: string[];
  customerDomains: string[];
  channelsMissingBot: string[];
  lastSyncAt?: string | null;
  syncProgress?: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    recordsProcessed: number;
    recordsTotal: number | null;
    startedAt?: string;
    completedAt?: string;
    error?: string | null;
  };
}

export interface SlackChannelSummary {
  id: string;
  name: string;
  isPrivate: boolean;
  botPresent: boolean;
  botAccessError?: string | null;
}

export interface SlackMessageSample {
  ts: string;
  userId: string;
  userEmail?: string | null;
  isBot?: boolean;
  threadTs?: string | null;
  textPreview?: string;
  mentionsExec?: boolean;
}

export interface SlackChannelSignals {
  channelId: string;
  channelName: string;
  botPresent: boolean;
  botAccessError?: string | null;
  lastCustomerMessageAt: string | null;
  lastInternalResponseAt: string | null;
  lastActivityAt: string | null;
  lastEscalationAt: string | null;
  messageSampleCount: number;
  stale: boolean;
}

export interface SlackSignalComputationInput {
  messages: SlackMessageSample[];
  internalDomains: string[];
  customerDomains: string[];
  domainOverrides?: string[];
  botPresent: boolean;
  botAccessError?: string | null;
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email?.includes('@')) return null;
  return email.split('@')[1]?.trim().toLowerCase() ?? null;
}

export function isInternalParticipant(
  email: string | null | undefined,
  internalDomains: string[],
  domainOverrides: string[] = [],
): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return true;
  if (domainOverrides.map((item) => item.toLowerCase()).includes(domain)) {
    return false;
  }
  return internalDomains.map((item) => item.toLowerCase()).includes(domain);
}

export function isCustomerParticipant(
  email: string | null | undefined,
  customerDomains: string[],
  internalDomains: string[],
  domainOverrides: string[] = [],
): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  if (domainOverrides.map((item) => item.toLowerCase()).includes(domain)) {
    return true;
  }
  if (internalDomains.map((item) => item.toLowerCase()).includes(domain)) {
    return false;
  }
  return customerDomains.map((item) => item.toLowerCase()).includes(domain);
}

export function detectEscalation(message: SlackMessageSample): boolean {
  const preview = (message.textPreview ?? '').toLowerCase();
  const keywordMatch = SLACK_ESCALATION_KEYWORDS.some((keyword) => preview.includes(keyword));
  if (!keywordMatch) return false;
  return Boolean(message.mentionsExec);
}

export function computeSlackChannelSignals(input: SlackSignalComputationInput): SlackChannelSignals {
  const sorted = [...input.messages].sort((a, b) => Number(b.ts) - Number(a.ts));
  let lastCustomerMessageAt: string | null = null;
  let lastInternalResponseAt: string | null = null;
  let lastActivityAt: string | null = null;
  let lastEscalationAt: string | null = null;

  for (const message of sorted) {
    if (message.isBot) continue;
    const occurredAt = slackTsToIso(message.ts);
    if (!lastActivityAt || occurredAt > lastActivityAt) {
      lastActivityAt = occurredAt;
    }

    if (detectEscalation(message)) {
      if (!lastEscalationAt || occurredAt > lastEscalationAt) {
        lastEscalationAt = occurredAt;
      }
    }

    if (
      isCustomerParticipant(
        message.userEmail,
        input.customerDomains,
        input.internalDomains,
        input.domainOverrides,
      )
    ) {
      if (!lastCustomerMessageAt || occurredAt > lastCustomerMessageAt) {
        lastCustomerMessageAt = occurredAt;
      }
      continue;
    }

    if (
      isInternalParticipant(message.userEmail, input.internalDomains, input.domainOverrides ?? [])
    ) {
      if (!lastInternalResponseAt || occurredAt > lastInternalResponseAt) {
        lastInternalResponseAt = occurredAt;
      }
    }
  }

  return {
    channelId: '',
    channelName: '',
    botPresent: input.botPresent,
    botAccessError: input.botAccessError ?? null,
    lastCustomerMessageAt,
    lastInternalResponseAt,
    lastActivityAt,
    lastEscalationAt,
    messageSampleCount: sorted.length,
    stale: false,
  };
}

export function slackTsToIso(ts: string): string {
  const [seconds] = ts.split('.');
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed)) return new Date().toISOString();
  return new Date(parsed * 1000).toISOString();
}

export function suggestChannelMappings(
  channels: SlackChannelSummary[],
  beaconProjects: Array<{ id: string; name: string }>,
): Array<{
  channelId: string;
  channelName: string;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  confidence: number;
  botPresent: boolean;
  botAccessError?: string | null;
}> {
  return channels.map((channel) => {
    const channelName = channel.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    let best: { id: string; name: string; score: number } | null = null;

    for (const project of beaconProjects) {
      const projectName = project.name.toLowerCase();
      let score = 0;
      if (channelName.includes(projectName) || projectName.includes(channelName)) score = 90;
      else if (projectName.split(/\s+/).some((word) => channelName.includes(word) && word.length > 3)) {
        score = 55;
      } else if (channelName.includes('implementation') && projectName.includes('implementation')) {
        score = 70;
      }
      if (!best || score > best.score) {
        best = { id: project.id, name: project.name, score };
      }
    }

    return {
      channelId: channel.id,
      channelName: channel.name,
      suggestedProjectId: best && best.score >= 50 ? best.id : null,
      suggestedProjectName: best && best.score >= 50 ? best.name : null,
      confidence: best?.score ?? 0,
      botPresent: channel.botPresent,
      botAccessError: channel.botAccessError ?? null,
    };
  });
}

export function customerWaitingDaysFromSignals(
  signals: Pick<
    SlackChannelSignals,
    'lastCustomerMessageAt' | 'lastInternalResponseAt' | 'lastActivityAt'
  >,
  timezone: string,
  businessDaysBetween: (start: Date, end: Date, timezone?: string) => number,
  now = new Date(),
): number | null {
  if (!signals.lastInternalResponseAt) return null;
  const internalAt = new Date(signals.lastInternalResponseAt);
  const customerAt = signals.lastCustomerMessageAt ? new Date(signals.lastCustomerMessageAt) : null;

  if (customerAt && customerAt.getTime() >= internalAt.getTime()) {
    return null;
  }

  return businessDaysBetween(internalAt, now, timezone);
}
