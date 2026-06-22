import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    globalSetup: ['./src/test/global-setup.ts'],
    globalTeardown: ['./src/test/global-teardown.ts'],
    env: {
      NODE_ENV: 'test',
      AUTH_DEV_MODE: 'true',
      DATABASE_URL: 'postgres://beacon:beacon@localhost:5433/beacon',
      REDIS_URL: 'redis://localhost:6380',
    },
  },
});
