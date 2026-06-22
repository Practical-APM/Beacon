import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    env: {
      DATABASE_URL: 'postgres://beacon:beacon@localhost:5433/beacon',
    },
  },
});
