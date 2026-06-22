import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('Linear integration (mock mode)', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it.skipIf(!dbIntegrationReady())('connects mock Linear and syncs issues', async () => {
    const connectRes = await app.request('/v1/integrations/linear/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({}),
    });
    expect(connectRes.status).toBe(200);

    const syncRes = await app.request('/v1/integrations/linear/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ jobType: 'bulk' }),
    });
    expect(syncRes.status).toBe(200);
    const syncBody = (await syncRes.json()) as { recordsProcessed: number; recordsTotal: number };
    expect(syncBody.recordsProcessed).toBeGreaterThanOrEqual(1);
    expect(syncBody.recordsTotal).toBeGreaterThanOrEqual(1);

    const statusRes = await app.request('/v1/integrations/linear/status', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as { status: string; connected: boolean };
    expect(statusBody.connected).toBe(true);
    expect(statusBody.status).toBe('connected');
  });
});
