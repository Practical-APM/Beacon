import { validateDynamicsFieldMappings } from '@beacon/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('Dynamics 365 integration (mock mode)', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it('validates default field mappings as incomplete when empty', () => {
    const { complete } = validateDynamicsFieldMappings({});
    expect(complete).toBe(false);
  });

  it.skipIf(!dbIntegrationReady())('connects mock Dynamics and syncs opportunities', async () => {
    const connectRes = await app.request('/v1/integrations/microsoft-dynamics/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({}),
    });
    expect(connectRes.status).toBe(200);
    const connectBody = (await connectRes.json()) as { orgChanged?: boolean };
    expect(connectBody.orgChanged).toBe(false);

    const syncRes = await app.request('/v1/integrations/microsoft-dynamics/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ jobType: 'bulk' }),
    });
    expect(syncRes.status).toBe(200);
    const syncBody = (await syncRes.json()) as { recordsProcessed: number; recordsTotal: number };
    expect(syncBody.recordsProcessed).toBeGreaterThanOrEqual(10);

    const statusRes = await app.request('/v1/integrations/microsoft-dynamics/status', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as { status: string; connected: boolean };
    expect(statusBody.connected).toBe(true);
    expect(statusBody.status).toBe('connected');
  });

  it.skipIf(!dbIntegrationReady())('detects Dynamics org change on reconnect', async () => {
    await app.request('/v1/integrations/microsoft-dynamics/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({}),
    });

    const reconnectRes = await app.request('/v1/integrations/microsoft-dynamics/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ orgId: 'mock-dynamics-org-002' }),
    });
    expect(reconnectRes.status).toBe(200);
    const body = (await reconnectRes.json()) as { orgChanged?: boolean };
    expect(body.orgChanged).toBe(true);
  });
});
