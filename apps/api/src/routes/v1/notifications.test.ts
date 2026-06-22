import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('notifications API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(async () => {
    tenantId = testTenantAcmeId();
    await app.request('/v1/notifications/preferences', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ frequency: 'daily', minSeverity: 'high' }),
    });
  });

  it.skipIf(!dbIntegrationReady())('returns default notification preferences', async () => {
    const res = await app.request('/v1/notifications/preferences', {
      headers: authHeaders('admin-a', tenantId),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      preferences: { emailEnabled: boolean; frequency: string; minSeverity: string };
    };
    expect(body.preferences.emailEnabled).toBe(true);
    expect(body.preferences.frequency).toBe('daily');
    expect(body.preferences.minSeverity).toBe('high');
  });

  it.skipIf(!dbIntegrationReady())('updates user notification preferences', async () => {
    const patchRes = await app.request('/v1/notifications/preferences', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ frequency: 'immediate_only', minSeverity: 'critical' }),
    });

    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as {
      preferences: { frequency: string; minSeverity: string };
    };
    expect(patchBody.preferences.frequency).toBe('immediate_only');
    expect(patchBody.preferences.minSeverity).toBe('critical');
  });

  it.skipIf(!dbIntegrationReady())('lists in-app notifications and unread count', async () => {
    const listRes = await app.request('/v1/notifications', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: unknown[] };
    expect(Array.isArray(listBody.data)).toBe(true);

    const countRes = await app.request('/v1/notifications/unread-count', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(countRes.status).toBe(200);
    const countBody = (await countRes.json()) as { count: number };
    expect(typeof countBody.count).toBe('number');
  });

  it.skipIf(!dbIntegrationReady())('allows admin to read and update org notification settings', async () => {
    const getRes = await app.request('/v1/admin/notifications/settings', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(getRes.status).toBe(200);

    const patchRes = await app.request('/v1/admin/notifications/settings', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ digestEnabled: true, orgMinSeverity: 'high' }),
    });
    expect(patchRes.status).toBe(200);
    const body = (await patchRes.json()) as { settings: { digestEnabled: boolean } };
    expect(body.settings.digestEnabled).toBe(true);
  });

  it('rejects unsubscribe without token', async () => {
    const res = await app.request('/v1/notifications/unsubscribe');
    expect(res.status).toBe(400);
  });
});
