import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('outbound webhooks API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it.skipIf(!dbIntegrationReady())('creates webhook subscription and lists deliveries', async () => {
    const createRes = await app.request('/v1/admin/webhooks', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({
        url: 'http://localhost:9999/webhook-test',
        description: 'Test hook',
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as { subscription: { id: string }; secret: string };
    expect(createBody.secret.length).toBeGreaterThan(20);

    const listRes = await app.request('/v1/admin/webhooks', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.some((item) => item.id === createBody.subscription.id)).toBe(true);
  });
});
