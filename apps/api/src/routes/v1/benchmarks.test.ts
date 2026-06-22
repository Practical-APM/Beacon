import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  clearIntegrationSyncLocks,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('portfolio benchmarks API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(async () => {
    tenantId = testTenantAcmeId();
    await clearIntegrationSyncLocks(tenantId);
    await app.request('/v1/admin/feature-flags', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ benchmarkParticipationEnabled: false }),
    });
  });

  it.skipIf(!dbIntegrationReady())('returns disabled benchmark view when tenant has not opted in', async () => {
    const response = await app.request('/v1/benchmarks/portfolio', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      benchmark: { participationEnabled: boolean; metrics: unknown[] };
    };
    expect(body.benchmark.participationEnabled).toBe(false);
    expect(body.benchmark.metrics).toHaveLength(4);
  });

  it.skipIf(!dbIntegrationReady())('refreshes tenant snapshot after opt-in', async () => {
    const enableRes = await app.request('/v1/admin/feature-flags', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ benchmarkParticipationEnabled: true }),
    });
    expect(enableRes.status).toBe(200);

    const refreshRes = await app.request('/v1/admin/benchmarks/refresh', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
    });
    expect(refreshRes.status).toBe(200);

    const portfolioRes = await app.request('/v1/benchmarks/portfolio', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(portfolioRes.status).toBe(200);
    const portfolioBody = (await portfolioRes.json()) as {
      benchmark: { participationEnabled: boolean; snapshotDate: string | null };
    };
    expect(portfolioBody.benchmark.participationEnabled).toBe(true);
    expect(portfolioBody.benchmark.snapshotDate).toBeTruthy();
  });
});
