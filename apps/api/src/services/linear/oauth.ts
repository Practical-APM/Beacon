import { LINEAR_OAUTH_SCOPES, type LinearIntegrationMetadata } from '@beacon/shared';
import type { LinearCredentials } from './types.js';

export function buildDefaultLinearMetadata(
  organizationId: string,
  organizationName: string,
): LinearIntegrationMetadata {
  return {
    organizationId,
    organizationName,
    mappingComplete: true,
  };
}

export function toMetadataJson(metadata: LinearIntegrationMetadata): Record<string, unknown> {
  return metadata as unknown as Record<string, unknown>;
}

export function buildLinearOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: LINEAR_OAUTH_SCOPES.join(','),
    state: params.state,
  });
  return `https://linear.app/oauth/authorize?${query.toString()}`;
}

export async function exchangeLinearAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<LinearCredentials> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
  });

  const res = await fetch('https://api.linear.app/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Linear token exchange failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  };

  const org = await fetchLinearOrganization(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    organizationId: org.id,
    organizationName: org.name,
    issuedAt: String(Date.now()),
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

export async function refreshLinearAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  organizationId: string;
  organizationName: string;
}): Promise<LinearCredentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const res = await fetch('https://api.linear.app/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Linear token refresh failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? params.refreshToken,
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    issuedAt: String(Date.now()),
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

async function fetchLinearOrganization(accessToken: string): Promise<{ id: string; name: string }> {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: '{ viewer { organization { id name } } }',
    }),
  });

  if (!res.ok) {
    return { id: 'linear-org', name: 'Linear Organization' };
  }

  const payload = (await res.json()) as {
    data?: { viewer?: { organization?: { id?: string; name?: string } } };
  };
  return {
    id: payload.data?.viewer?.organization?.id ?? 'linear-org',
    name: payload.data?.viewer?.organization?.name ?? 'Linear Organization',
  };
}
