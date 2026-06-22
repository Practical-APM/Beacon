import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  seedDemoContext,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('Jira integration (mock mode)', () => {
  const app = createApp();
  let tenantId = '';
  let projectId = '';

  beforeAll(async () => {
    const demo = await seedDemoContext();
    tenantId = demo.tenantId;
    projectId = demo.projectId;
  });

  it.skipIf(!dbIntegrationReady())('connects mock Jira, syncs issues, and stores dependencies', async () => {
    const connectRes = await app.request('/v1/integrations/jira/mock-connect', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: '{}',
    });
    expect(connectRes.status).toBe(200);

    const syncRes = await app.request('/v1/integrations/jira/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ jobType: 'bulk' }),
    });
    expect(syncRes.status).toBe(200);
    const syncBody = (await syncRes.json()) as { recordsProcessed: number };
    expect(syncBody.recordsProcessed).toBeGreaterThan(0);

    const statusRes = await app.request('/v1/integrations/jira/status', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as {
      connected: boolean;
      orphans: Array<{ id: string }>;
    };
    expect(statusBody.connected).toBe(true);
    expect(statusBody.orphans.length).toBeGreaterThan(0);

    if (!projectId) return;
    const depsRes = await app.request(`/v1/projects/${projectId}/task-dependencies`, {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(depsRes.status).toBe(200);
    const depsBody = (await depsRes.json()) as { dependencies: unknown[] };
    expect(depsBody.dependencies.length).toBeGreaterThan(0);
  });
});
