import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('risk engine API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it.skipIf(!dbIntegrationReady())('evaluates risks and returns feed entries with evidence', async () => {
    const evaluateRes = await app.request('/v1/risks/evaluate/sync', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({}),
    });
    expect(evaluateRes.status).toBe(200);
    const evaluateBody = (await evaluateRes.json()) as { risksCreated: number; risksUpdated: number };
    expect(evaluateBody.risksCreated + evaluateBody.risksUpdated).toBeGreaterThanOrEqual(0);

    const risksRes = await app.request('/v1/risks?status=open', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(risksRes.status).toBe(200);
    const risksBody = (await risksRes.json()) as { data: Array<{ evidence: unknown[]; ruleKey?: string }> };
    expect(risksBody.data.length).toBeGreaterThan(0);
    expect(risksBody.data[0]?.evidence.length).toBeGreaterThan(0);
  });
});
