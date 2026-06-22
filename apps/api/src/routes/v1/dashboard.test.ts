import { createDb, risks } from '@beacon/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  seedDemoContext,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('dashboard and caching API', () => {
  const app = createApp();
  let tenantId = '';
  let projectId = '';
  let riskId = '';

  beforeAll(async () => {
    const demo = await seedDemoContext();
    tenantId = demo.tenantId;
    projectId = demo.projectId;
    riskId = demo.riskId;
  });

  it.skipIf(!dbIntegrationReady())('returns dashboard summary with rate limit headers', async () => {
    const res = await app.request('/v1/dashboard', {
      headers: authHeaders('admin-a', tenantId),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    const body = (await res.json()) as {
      activeProjects: number;
      atRiskProjects: number;
      totalDelayedArr: number | null;
      multiCurrency: boolean;
      openRiskCount: number;
      cached: boolean;
    };
    expect(body.activeProjects).toBeGreaterThan(0);
    expect(body.openRiskCount).toBeGreaterThanOrEqual(1);
    expect(body.multiCurrency).toBe(false);
    expect(typeof body.totalDelayedArr).toBe('number');
  });

  it.skipIf(!dbIntegrationReady())('dedupes revenue impact by project', async () => {
    const res = await app.request('/v1/revenue-impact', {
      headers: authHeaders('admin-a', tenantId),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totalDelayedArr: number | null;
      multiCurrency: boolean;
      atRiskProjects: number;
      projects: Array<{ projectId: string; openRiskCount: number }>;
    };

    const project = body.projects.find((row) => row.projectId === projectId);
    expect(project?.openRiskCount).toBeGreaterThanOrEqual(2);
    expect(body.multiCurrency).toBe(false);
    expect(body.totalDelayedArr).toBe(45000);
    expect(body.atRiskProjects).toBe(body.projects.length);
  });

  it.skipIf(!dbIntegrationReady())('includes health summary on project list', async () => {
    const res = await app.request('/v1/projects?limit=5', {
      headers: authHeaders('admin-a', tenantId),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ healthSummary?: { openRiskCount: number } }>;
    };
    expect(body.data[0]?.healthSummary?.openRiskCount).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(!dbIntegrationReady())('returns full project detail', async () => {
    const res = await app.request(`/v1/projects/${projectId}?detail=full`, {
      headers: authHeaders('admin-a', tenantId),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      project: { id: string };
      openRisks: unknown[];
      health: { openRiskCount: number };
    };
    expect(body.project.id).toBe(projectId);
    expect(body.openRisks.length).toBeGreaterThan(0);
    expect(body.health.openRiskCount).toBe(body.openRisks.length);
  });

  it.skipIf(!dbIntegrationReady())('returns 409 on stale risk version', async () => {
    const getRes = await app.request(`/v1/risks/${riskId}`, {
      headers: authHeaders('admin-a', tenantId),
    });
    const { risk } = (await getRes.json()) as { risk: { version: number } };

    const stale = await app.request(`/v1/risks/${riskId}`, {
      method: 'PATCH',
      headers: {
        ...authHeaders('admin-a', tenantId),
        'Idempotency-Key': `stale-version-${Date.now()}`,
      },
      body: JSON.stringify({ status: 'acknowledged', version: risk.version + 99 }),
    });
    expect(stale.status).toBe(409);
  });

  it.skipIf(!dbIntegrationReady())('exports projects as CSV', async () => {
    const res = await app.request('/v1/projects?format=csv', {
      headers: authHeaders('admin-a', tenantId),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const text = await res.text();
    expect(text.startsWith('id,name,status')).toBe(true);
  });
});
