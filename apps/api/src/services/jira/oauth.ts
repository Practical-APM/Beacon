import {
  DEFAULT_JIRA_ISSUE_TYPE_MAPPING,
  type JiraIntegrationMetadata,
} from '@beacon/shared';
import type { JiraCredentials } from './types.js';

const JIRA_AUTH_URL = 'https://auth.atlassian.com/authorize';
const JIRA_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const JIRA_SCOPES = [
  'read:jira-work',
  'read:jira-user',
  'write:jira-work',
  'offline_access',
  'manage:jira-webhook',
].join(' ');

export function buildDefaultJiraMetadata(cloudId: string, siteUrl: string): JiraIntegrationMetadata {
  return {
    cloudId,
    siteUrl,
    issueTypeMapping: { ...DEFAULT_JIRA_ISSUE_TYPE_MAPPING },
    orphanProjectIds: [],
    lastSyncAt: null,
    webhookRegistered: false,
  };
}

export function buildJiraOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const query = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: params.clientId,
    scope: JIRA_SCOPES,
    redirect_uri: params.redirectUri,
    state: params.state,
    response_type: 'code',
    prompt: 'consent',
  });
  return `${JIRA_AUTH_URL}?${query.toString()}`;
}

export async function exchangeJiraAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<JiraCredentials> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const res = await fetch(JIRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Jira token exchange failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };

  const resource = await getAccessibleResource(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    cloudId: resource.id,
    siteUrl: resource.url,
    issuedAt: String(Date.now()),
  };
}

export async function refreshJiraAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  cloudId: string;
  siteUrl: string;
}): Promise<JiraCredentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });

  const res = await fetch(JIRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Jira token refresh failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? params.refreshToken,
    cloudId: params.cloudId,
    siteUrl: params.siteUrl,
    issuedAt: String(Date.now()),
  };
}

async function getAccessibleResource(accessToken: string): Promise<{ id: string; url: string }> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to load Jira accessible resources: ${await res.text()}`);
  }
  const resources = (await res.json()) as Array<{ id: string; url: string }>;
  const first = resources[0];
  if (!first) {
    throw new Error('No accessible Jira sites found for this account');
  }
  return first;
}

export function toMetadataJson(metadata: JiraIntegrationMetadata): Record<string, unknown> {
  return metadata as unknown as Record<string, unknown>;
}
