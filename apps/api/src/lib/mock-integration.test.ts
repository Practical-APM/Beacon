import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('mock integration helpers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects mock access tokens', async () => {
    const { isMockAccessToken } = await import('./mock-integration.js');
    expect(isMockAccessToken('mock-access-token')).toBe(true);
    expect(isMockAccessToken('real-token')).toBe(false);
  });

  it('blocks mock integration usage outside development auth mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DEV_MODE = 'false';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/beacon';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.CLERK_SECRET_KEY = 'sk_test_example';

    const { assertMockIntegrationAllowed } = await import('./mock-integration.js');
    expect(() => assertMockIntegrationAllowed('Mock Salesforce sync')).toThrow(
      'Mock Salesforce sync is not available outside development mode',
    );
  });
});
