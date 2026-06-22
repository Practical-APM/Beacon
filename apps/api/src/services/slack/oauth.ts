import type { SlackIntegrationMetadata } from '@beacon/shared';
import { SLACK_BOT_SCOPES, SLACK_USER_SCOPES } from '@beacon/shared';
import type { SlackCredentials } from './types.js';

export function buildDefaultSlackMetadata(
  teamId: string,
  teamName: string,
  botUserId: string,
): SlackIntegrationMetadata {
  return {
    teamId,
    teamName,
    botUserId,
    internalDomains: ['acme-demo.test', 'beacon.test'],
    customerDomains: ['customer.com', 'acmecorp.com'],
    channelsMissingBot: [],
    lastSyncAt: null,
    syncProgress: {
      status: 'idle',
      recordsProcessed: 0,
      recordsTotal: null,
    },
  };
}

export function toMetadataJson(metadata: SlackIntegrationMetadata): Record<string, unknown> {
  return metadata as unknown as Record<string, unknown>;
}

export function buildSlackOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const scope = [...SLACK_BOT_SCOPES, ...SLACK_USER_SCOPES].join(',');
  const search = new URLSearchParams({
    client_id: params.clientId,
    scope,
    redirect_uri: params.redirectUri,
    state: params.state,
  });
  return `https://slack.com/oauth/v2/authorize?${search.toString()}`;
}

export async function exchangeSlackAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<SlackCredentials> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
  });

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    team?: { id?: string; name?: string };
    bot_user_id?: string;
    scope?: string;
    authed_user?: { access_token?: string };
  };

  if (!payload.ok || !payload.access_token || !payload.team?.id) {
    throw new Error(payload.error ?? 'Slack OAuth exchange failed');
  }

  return {
    accessToken: payload.authed_user?.access_token ?? payload.access_token,
    botAccessToken: payload.access_token,
    teamId: payload.team.id,
    teamName: payload.team.name ?? 'Slack Workspace',
    botUserId: payload.bot_user_id ?? 'B000',
    scope: payload.scope ?? SLACK_BOT_SCOPES.join(','),
  };
}
