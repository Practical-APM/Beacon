import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  clearIntegrationSyncLocks,
  dbIntegrationReady,
  seedDemoContext,
} from '../../test/integration-env.js';

describe('slack integration API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(async () => {
    const demo = await seedDemoContext();
    tenantId = demo.tenantId;
    await clearIntegrationSyncLocks(tenantId);
  });

  it.skipIf(!dbIntegrationReady())('mock connect, sync, and expose channel signals', async () => {
    const connectRes = await app.request('/v1/integrations/slack/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: '{}',
    });
    expect(connectRes.status).toBe(200);

    const syncRes = await app.request('/v1/integrations/slack/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ jobType: 'bulk' }),
    });
    expect(syncRes.status).toBe(200);

    const statusRes = await app.request('/v1/integrations/slack/status', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as {
      mappings: unknown[];
      signals: Array<{ lastCustomerMessageAt?: string | null }>;
    };
    expect(statusBody.mappings.length).toBeGreaterThanOrEqual(3);
    expect(statusBody.signals.length).toBeGreaterThan(0);
  });
});
