import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('risk rules admin API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it.skipIf(!dbIntegrationReady())('reads and updates tenant risk rules', async () => {
    const getRes = await app.request('/v1/admin/risk-rules', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { rules: { rules: Array<{ key: string }> } };
    expect(getBody.rules.rules.length).toBe(6);

    const patchRes = await app.request('/v1/admin/risk-rules', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({
        rules: {
          project_inactivity: { enabled: false, thresholdBusinessDays: 12 },
        },
      }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as {
      rules: { rules: Array<{ key: string; config: { enabled: boolean } }> };
    };
    const inactivity = patchBody.rules.rules.find((rule) => rule.key === 'project_inactivity');
    expect(inactivity?.config.enabled).toBe(false);
  });
});
