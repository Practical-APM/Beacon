import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('compliance API', () => {
  const app = createApp();
  let tenantId = '';

  beforeAll(() => {
    tenantId = testTenantAcmeId();
  });

  it.skipIf(!dbIntegrationReady())('exports user data for GDPR request', async () => {
    const res = await app.request('/v1/privacy/export', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { export: { user: { email: string } } };
    expect(body.export.user.email).toContain('@');
  });

  it.skipIf(!dbIntegrationReady())('creates deletion request and lists audit events', async () => {
    const deleteRes = await app.request('/v1/privacy/deletion-request', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ notes: 'Please delete my account data' }),
    });
    expect(deleteRes.status).toBe(201);

    const auditRes = await app.request('/v1/admin/audit-events?limit=5', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(auditRes.status).toBe(200);
    const auditBody = (await auditRes.json()) as { data: Array<{ action: string }> };
    expect(Array.isArray(auditBody.data)).toBe(true);
  });

  it.skipIf(!dbIntegrationReady())('processes deletion request for admin review', async () => {
    const createRes = await app.request('/v1/privacy/deletion-request', {
      method: 'POST',
      headers: authHeaders('admin-a', tenantId),
      body: JSON.stringify({ notes: 'Integration test deletion workflow' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { request: { id: string; status: string } };
    if (created.request.status !== 'pending') return;

    const rejectRes = await app.request(
      `/v1/admin/privacy/deletion-requests/${created.request.id}`,
      {
        method: 'PATCH',
        headers: authHeaders('admin-a', tenantId),
        body: JSON.stringify({ action: 'reject' }),
      },
    );
    expect(rejectRes.status).toBe(200);
    const rejected = (await rejectRes.json()) as { request: { status: string } };
    expect(rejected.request.status).toBe('rejected');
  });

  it.skipIf(!dbIntegrationReady())('returns resolved feature flags for admin', async () => {
    const res = await app.request('/v1/admin/feature-flags', {
      headers: authHeaders('admin-a', tenantId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { flags: { llmEnabled: boolean } };
    expect(typeof body.flags.llmEnabled).toBe('boolean');
  });
});
