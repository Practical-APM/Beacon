import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  seedDemoContext,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('operational graph API', () => {
  const app = createApp();
  let tenantId = '';
  let projectId = '';

  beforeAll(async () => {
    const demo = await seedDemoContext();
    tenantId = demo.tenantId;
    projectId = demo.projectId;
  });

  it.skipIf(!dbIntegrationReady())('rebuilds graph and returns portfolio + blockers', async () => {
    const rebuildRes = await app.request('/v1/graph/rebuild', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ rebuildType: 'full' }),
    });
    expect(rebuildRes.status).toBe(200);
    const rebuildBody = (await rebuildRes.json()) as { edgesBuilt: number };
    expect(rebuildBody.edgesBuilt).toBeGreaterThan(0);

    const portfolioRes = await app.request('/v1/graph/portfolio', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(portfolioRes.status).toBe(200);
    const portfolioBody = (await portfolioRes.json()) as { projects: unknown[] };
    expect(portfolioBody.projects.length).toBeGreaterThan(0);

    if (!projectId) return;

    const graphRes = await app.request(`/v1/graph/projects/${projectId}`, {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(graphRes.status).toBe(200);
    const graphBody = (await graphRes.json()) as { nodes: unknown[]; edges: unknown[] };
    expect(graphBody.nodes.length).toBeGreaterThan(0);
    expect(graphBody.edges.length).toBeGreaterThan(0);

    const blockersRes = await app.request(`/v1/graph/projects/${projectId}/blockers`, {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(blockersRes.status).toBe(200);
  });
});
