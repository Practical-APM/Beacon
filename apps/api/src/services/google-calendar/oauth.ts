import type { GoogleCalendarIntegrationMetadata } from '@beacon/shared/google-calendar';
import { GOOGLE_CALENDAR_SCOPES } from '@beacon/shared/google-calendar';
import type { GoogleCalendarCredentials } from './types.js';

export function buildDefaultGoogleCalendarMetadata(
  accountEmail: string,
  accountName: string,
): GoogleCalendarIntegrationMetadata {
  const emailDomain = accountEmail.split('@')[1]?.toLowerCase();
  return {
    accountEmail,
    accountName,
    internalDomains: emailDomain ? [emailDomain] : [],
    customerDomains: [],
    lastSyncAt: null,
    syncProgress: {
      status: 'idle',
      recordsProcessed: 0,
      recordsTotal: null,
    },
  };
}

export function toMetadataJson(metadata: GoogleCalendarIntegrationMetadata): Record<string, unknown> {
  return metadata as unknown as Record<string, unknown>;
}

export function buildGoogleCalendarOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_CALENDAR_SCOPES.join(' '),
    state: params.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${search.toString()}`;
}

export async function exchangeGoogleCalendarAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleCalendarCredentials> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };

  if (!tokenPayload.access_token) {
    throw new Error(tokenPayload.error ?? 'Google OAuth exchange failed');
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const profile = (await profileResponse.json()) as { email?: string; name?: string };

  return {
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token,
    expiresAt: tokenPayload.expires_in
      ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
      : undefined,
    accountEmail: profile.email ?? 'unknown@google.com',
    accountName: profile.name ?? 'Google Account',
    scope: tokenPayload.scope ?? GOOGLE_CALENDAR_SCOPES.join(' '),
  };
}
