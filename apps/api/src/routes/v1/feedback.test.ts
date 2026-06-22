import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  seedDemoContext,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('recommendation feedback API', () => {
  const app = createApp();
  let tenantId = '';
  let projectId = '';

  beforeAll(async () => {
    const demo = await seedDemoContext();
    tenantId = demo.tenantId;
    projectId = demo.projectId;
  });

  it.skipIf(!dbIntegrationReady())('submits insight feedback and returns summary', async () => {
    const generateRes = await app.request(`/v1/projects/${projectId}/insights/generate`, {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({}),
    });
    expect(generateRes.status).toBe(200);
    const generateBody = (await generateRes.json()) as {
      data: Array<{ id: string; riskId: string }>;
    };
    const insight = generateBody.data[0];
    expect(insight).toBeTruthy();

    const feedbackRes = await app.request('/v1/feedback', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({
        projectId,
        targetType: 'insight',
        targetId: insight!.id,
        rating: 'helpful',
        comment: 'Accurate root cause',
      }),
    });
    expect(feedbackRes.status).toBe(201);

    const summaryRes = await app.request('/v1/admin/feedback/summary', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(summaryRes.status).toBe(200);
    const summaryBody = (await summaryRes.json()) as { summary: { total: number } };
    expect(summaryBody.summary.total).toBeGreaterThan(0);
  });
});
