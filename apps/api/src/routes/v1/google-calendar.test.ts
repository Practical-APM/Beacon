import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('google calendar integration API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it.skipIf(!dbIntegrationReady())('connects mock Google Calendar and syncs meetings', async () => {
    const connectRes = await app.request('/v1/integrations/google-calendar/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
    });
    expect(connectRes.status).toBe(200);

    const syncRes = await app.request('/v1/integrations/google-calendar/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ jobType: 'bulk' }),
    });
    expect(syncRes.status).toBe(200);

    const statusRes = await app.request('/v1/integrations/google-calendar/status', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as { connected: boolean; signals: unknown[] };
    expect(statusBody.connected).toBe(true);
    expect(statusBody.signals.length).toBeGreaterThan(0);
  });
});
