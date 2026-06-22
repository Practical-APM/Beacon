import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  seedDemoContext,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('delay prediction API', () => {
  const app = createApp();
  let tenantId = '';
  let projectId = '';

  beforeAll(async () => {
    const demo = await seedDemoContext();
    tenantId = demo.tenantId;
    projectId = demo.projectId;
  });

  it.skipIf(!dbIntegrationReady())('returns delay prediction for active project', async () => {
    const response = await app.request(`/v1/projects/${projectId}/delay-prediction`, {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      prediction: { status: string; predictedDelayDays: number | null };
    };
    expect(['available', 'insufficient_data', 'disabled']).toContain(body.prediction.status);
    if (body.prediction.status === 'available') {
      expect(body.prediction.predictedDelayDays).not.toBeNull();
    }
  });
});
