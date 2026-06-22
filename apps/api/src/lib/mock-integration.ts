import { env } from '../env.js';

export const MOCK_ACCESS_TOKEN = 'mock-access-token';

export function mockIntegrationAllowed(): boolean {
  return env.AUTH_DEV_MODE;
}

export function isMockAccessToken(accessToken: string | undefined | null): boolean {
  return accessToken === MOCK_ACCESS_TOKEN;
}

export function isMockSlackCredentials(credentials: {
  accessToken?: string;
  botAccessToken?: string;
}): boolean {
  return (
    credentials.botAccessToken?.includes('-mock-') === true ||
    credentials.accessToken?.includes('-mock-') === true
  );
}

export function assertMockIntegrationAllowed(context: string): void {
  if (!mockIntegrationAllowed()) {
    throw new Error(`${context} is not available outside development mode`);
  }
}

export function buildOAuthConnectResponse(params: {
  enabled: boolean;
  connectUrl?: string | null;
  devMessage: string;
  prodMessage: string;
  extra?: Record<string, unknown>;
}) {
  if (params.enabled && params.connectUrl) {
    return { connectUrl: params.connectUrl, mockMode: false, ...params.extra };
  }

  return {
    connectUrl: null,
    mockMode: mockIntegrationAllowed(),
    message: mockIntegrationAllowed() ? params.devMessage : params.prodMessage,
    ...params.extra,
  };
}
