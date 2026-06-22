import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('operational CRUD and pagination', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it.skipIf(!dbIntegrationReady())('lists projects with pagination metadata', async () => {
    const res = await app.request('/v1/projects?limit=1', {
      headers: authHeaders('admin-a', tenantId),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: unknown[];
      pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination.limit).toBe(1);
  });

  it.skipIf(!dbIntegrationReady())('returns empty list shape for unknown customer filter context', async () => {
    const res = await app.request('/v1/customers?limit=5', {
      headers: authHeaders('admin-a', tenantId),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; pagination: { hasMore: boolean } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeTruthy();
  });

  it.skipIf(!dbIntegrationReady())('scopes contributor to assigned projects only', async () => {
    const res = await app.request('/v1/projects', {
      headers: authHeaders('contributor-a', tenantId),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ ownerEmail?: string | null; name?: string }> };
    for (const project of body.data) {
      expect(project.ownerEmail?.toLowerCase()).toBe('contributor-a@acme-demo.test');
    }
    expect(body.data.some((project) => project.name === 'Enterprise Rollout (Admin)')).toBe(false);
  });

  it.skipIf(!dbIntegrationReady())('blocks contributor from viewing admin-owned project detail', async () => {
    const listRes = await app.request('/v1/projects', {
      headers: authHeaders('admin-a', tenantId),
    });
    const listBody = (await listRes.json()) as { data: Array<{ id: string; name: string }> };
    const adminProject = listBody.data.find((project) => project.name === 'Enterprise Rollout (Admin)');
    if (!adminProject) return;

    const detailRes = await app.request(`/v1/projects/${adminProject.id}?detail=full`, {
      headers: authHeaders('contributor-a', tenantId),
    });
    expect(detailRes.status).toBe(404);
  });

  it.skipIf(!dbIntegrationReady())('blocks contributor from patching risk status', async () => {
    const risksRes = await app.request('/v1/risks?limit=5', {
      headers: authHeaders('admin-a', tenantId),
    });
    const risksBody = (await risksRes.json()) as { data: Array<{ id: string }> };
    const riskId = risksBody.data[0]?.id;
    if (!riskId) return;

    const patchRes = await app.request(`/v1/risks/${riskId}`, {
      method: 'PATCH',
      headers: authHeaders('contributor-a', tenantId),
      body: JSON.stringify({ status: 'acknowledged' }),
    });
    expect(patchRes.status).toBe(403);
  });

  it.skipIf(!dbIntegrationReady())('scopes contributor dashboard to owned projects', async () => {
    const adminRes = await app.request('/v1/dashboard', {
      headers: authHeaders('admin-a', tenantId),
    });
    const contributorRes = await app.request('/v1/dashboard', {
      headers: authHeaders('contributor-a', tenantId),
    });

    expect(adminRes.status).toBe(200);
    expect(contributorRes.status).toBe(200);

    const adminBody = (await adminRes.json()) as { activeProjects: number };
    const contributorBody = (await contributorRes.json()) as { activeProjects: number };
    expect(contributorBody.activeProjects).toBeLessThan(adminBody.activeProjects);
  });

  it.skipIf(!dbIntegrationReady())('supports idempotent project creation', async () => {
    const headers = {
      ...authHeaders('admin-a', tenantId),
      'Idempotency-Key': 'demo-create-project-test-key',
    };

    const payload = {
      customerId: (await getFirstCustomerId(app, tenantId)) ?? '',
      name: 'Idempotent Test Project',
      arrAmount: 10000,
      ownerEmail: 'admin-a@acme-demo.test',
    };

    if (!payload.customerId) return;

    const first = await app.request('/v1/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const second = await app.request('/v1/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, name: 'Different Name Should Not Matter' }),
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody).toEqual(firstBody);
  });
});

async function getFirstCustomerId(app: ReturnType<typeof createApp>, tenantId: string) {
  const res = await app.request('/v1/customers?limit=1', {
    headers: authHeaders('admin-a', tenantId),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data: Array<{ id: string }> };
  return body.data[0]?.id ?? null;
}
