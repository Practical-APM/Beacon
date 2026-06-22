import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('verifyAccessToken dev tokens', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts dev tokens in development when AUTH_DEV_MODE is enabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_DEV_MODE = 'true';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/beacon';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const { verifyAccessToken } = await import('./auth.js');
    const identity = await verifyAccessToken('dev:admin-a');
    expect(identity.externalAuthId).toBe('admin-a');
    expect(identity.email).toBe('admin-a@dev.beacon.test');
  });

  it('rejects dev tokens in production even when AUTH_DEV_MODE is true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DEV_MODE = 'true';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/beacon';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.CLERK_SECRET_KEY = 'sk_test_example';

    const { verifyAccessToken } = await import('./auth.js');
    await expect(verifyAccessToken('dev:admin-a')).rejects.toMatchObject({ status: 401 });
  });

  it('rejects dev tokens in staging', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.AUTH_DEV_MODE = 'true';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/beacon';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const { verifyAccessToken } = await import('./auth.js');
    await expect(verifyAccessToken('dev:admin-a')).rejects.toMatchObject({ status: 401 });
  });
});
