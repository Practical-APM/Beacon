import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';
import { isMockSlackCredentials } from '../../lib/mock-integration.js';
import { getMockSlackChannels, getMockSlackMessages, getMockSlackUsers } from './mock-data.js';
import type { SlackChannelRecord, SlackCredentials, SlackMessageRecord } from './types.js';

export class SlackClient {
  constructor(private readonly credentials: SlackCredentials) {}

  private get useMock(): boolean {
    if (isMockSlackCredentials(this.credentials)) {
      return true;
    }
    return !env.SLACK_ENABLED && env.AUTH_DEV_MODE;
  }

  async listChannels(): Promise<SlackChannelRecord[]> {
    if (this.useMock) {
      return getMockSlackChannels();
    }

    const response = await this.api<{ channels?: Array<Record<string, unknown>> }>('conversations.list', {
      types: 'public_channel,private_channel',
      exclude_archived: 'true',
      limit: '200',
    });
    return (response.channels ?? []).map((channel) => ({
      id: String(channel.id),
      name: String(channel.name ?? channel.id),
      isPrivate: Boolean(channel.is_private),
      isMember: Boolean(channel.is_member),
    }));
  }

  async listMessages(channelId: string, limit = 100): Promise<SlackMessageRecord[]> {
    if (this.useMock) {
      return getMockSlackMessages(channelId).slice(0, limit);
    }

    const response = await this.api<{ messages?: SlackMessageRecord[] }>('conversations.history', {
      channel: channelId,
      limit: String(Math.min(limit, 200)),
    });
    return response.messages ?? [];
  }

  async lookupUserEmail(userId: string): Promise<string | null> {
    if (this.useMock) {
      return getMockSlackUsers()[userId]?.email ?? null;
    }

    const response = await this.api<{ user?: { profile?: { email?: string } } }>('users.info', {
      user: userId,
    });
    return response.user?.profile?.email ?? null;
  }

  private async api<T>(method: string, params: Record<string, string>): Promise<T> {
    const body = new URLSearchParams({ ...params });
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.credentials.botAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const payload = (await response.json()) as T & { ok?: boolean; error?: string };
    if (!payload.ok) {
      throw new Error(payload.error ?? `Slack API ${method} failed`);
    }
    return payload;
  }
}
