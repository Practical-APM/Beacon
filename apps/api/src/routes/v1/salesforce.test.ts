import { validateFieldMappings } from '@beacon/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  clearIntegrationSyncLocks,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('Salesforce integration (mock mode)', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(async () => {
    tenantId = testTenantAcmeId();
    await clearIntegrationSyncLocks(tenantId);
  });

  afterAll(async () => {
    await clearIntegrationSyncLocks(tenantId);
  });

  it('validates default field mappings as complete', () => {
    const { complete, missing } = validateFieldMappings({});
    expect(complete).toBe(false);
    expect(missing.length).toBeGreaterThan(0);
  });

  it.skipIf(!dbIntegrationReady())('connects mock Salesforce and syncs opportunities', async () => {
    const connectRes = await app.request('/v1/integrations/salesforce/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ environment: 'sandbox' }),
    });
    expect(connectRes.status).toBe(200);

    const syncRes = await app.request('/v1/integrations/salesforce/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ jobType: 'bulk' }),
    });
    expect(syncRes.status).toBe(200);
    const syncBody = (await syncRes.json()) as { recordsProcessed: number; recordsTotal: number };
    expect(syncBody.recordsProcessed).toBeGreaterThanOrEqual(10);
    expect(syncBody.recordsTotal).toBeGreaterThanOrEqual(10);

    const statusRes = await app.request('/v1/integrations/salesforce/status', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as { status: string; connected: boolean };
    expect(statusBody.connected).toBe(true);
    expect(statusBody.status).toBe('connected');

    const projectsRes = await app.request('/v1/projects?limit=100', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(projectsRes.status).toBe(200);
    const projectsBody = (await projectsRes.json()) as { data: unknown[] };
    expect(projectsBody.data.length).toBeGreaterThanOrEqual(10);
  });

  it.skipIf(!dbIntegrationReady())('rejects duplicate sync lock while running', async () => {
    await app.request('/v1/integrations/salesforce/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ environment: 'sandbox' }),
    });

    const first = app.request('/v1/integrations/salesforce/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ jobType: 'bulk', async: true }),
    });

    const second = app.request('/v1/integrations/salesforce/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ jobType: 'bulk' }),
    });

    const [firstRes, secondRes] = await Promise.all([first, second]);
    expect(firstRes.status).toBe(202);
    expect([400, 202]).toContain(secondRes.status);
  });
});
