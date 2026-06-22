import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  clearProjectInsightCache,
  dbIntegrationReady,
  seedDemoContext,
} from '../../test/integration-env.js';

describe('intelligence insights API', () => {
  const app = createApp();
  let tenantId = '';
  let projectId = '';

  beforeAll(async () => {
    const demo = await seedDemoContext();
    tenantId = demo.tenantId;
    projectId = demo.projectId;
    await clearProjectInsightCache(tenantId, projectId);
  });

  it.skipIf(!dbIntegrationReady())('generates template insights linked to evidence', async () => {
    await clearProjectInsightCache(tenantId, projectId);
    await app.request('/v1/admin/intelligence', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ llmEnabled: false }),
    });

    const generateRes = await app.request(`/v1/projects/${projectId}/insights/generate`, {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({}),
    });
    expect(generateRes.status).toBe(200);
    const generateBody = (await generateRes.json()) as {
      data: Array<{ evidence: unknown[]; source: string; rootCause: string }>;
    };
    expect(generateBody.data.length).toBeGreaterThan(0);
    expect(generateBody.data[0]?.source).toBe('template');
    expect(generateBody.data[0]?.evidence.length).toBeGreaterThan(0);

    const listRes = await app.request(`/v1/projects/${projectId}/insights`, {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(listRes.status).toBe(200);
  });
});
