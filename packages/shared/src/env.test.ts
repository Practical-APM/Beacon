import { describe, expect, it } from 'vitest';
import { parseEnv, apiEnvSchema } from './env.js';

describe('parseEnv', () => {
  it('parses valid api env', () => {
    const env = parseEnv(apiEnvSchema, {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/beacon',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(env.PORT).toBe(3001);
    expect(env.OTEL_ENABLED).toBe(false);
    expect(env.AUTH_DEV_MODE).toBe(true);
  });

  it('disables dev auth mode when clerk key is set', () => {
    const env = parseEnv(apiEnvSchema, {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/beacon',
      REDIS_URL: 'redis://localhost:6379',
      CLERK_SECRET_KEY: 'sk_test_xxx',
    });

    expect(env.AUTH_DEV_MODE).toBe(false);
  });

  it('throws on invalid database url', () => {
    expect(() =>
      parseEnv(apiEnvSchema, {
        DATABASE_URL: 'not-a-url',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toThrow(/Invalid environment configuration/);
  });
});
