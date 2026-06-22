import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('user locale API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it.skipIf(!dbIntegrationReady())('updates user locale preference', async () => {
    const patchRes = await app.request('/v1/me/locale', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ locale: 'es' }),
    });
    expect(patchRes.status).toBe(200);
    const body = (await patchRes.json()) as { user: { locale: string } };
    expect(body.user.locale).toBe('es');

    const meRes = await app.request('/v1/me', {
      headers: authHeaders('admin-a', tenantId),
    });
    const meBody = (await meRes.json()) as { user: { locale: string } };
    expect(meBody.user.locale).toBe('es');
  });
});
