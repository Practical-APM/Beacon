import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
} from '../../test/integration-env.js';

describe('integration setup routes', () => {
  const app = createApp();
  const tenantId = () => testTenantAcmeId();

  it.skipIf(!dbIntegrationReady())('returns core CRM preference for operational users', async () => {
    const res = await app.request('/v1/integrations/core-crm/preference', {
      headers: authHeaders('admin-a', tenantId()),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { coreCrmId: string; options: unknown[] };
    expect(typeof body.coreCrmId).toBe('string');
    expect(Array.isArray(body.options)).toBe(true);
  });

  it.skipIf(!dbIntegrationReady())('allows admin to update core CRM preference', async () => {
    const res = await app.request('/v1/integrations/core-crm/preference', {
      method: 'PATCH',
      headers: authHeaders('admin-a', tenantId()),
      body: JSON.stringify({ coreCrmId: 'salesforce' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { coreCrmId: string };
    expect(body.coreCrmId).toBe('salesforce');
  });

  it.skipIf(!dbIntegrationReady())('blocks contributor from updating core CRM preference', async () => {
    const res = await app.request('/v1/integrations/core-crm/preference', {
      method: 'PATCH',
      headers: authHeaders('contributor-a', tenantId()),
      body: JSON.stringify({ coreCrmId: 'hubspot' }),
    });

    expect(res.status).toBe(403);
  });

  it.skipIf(!dbIntegrationReady())('returns setup state for onboarding wizard', async () => {
    const res = await app.request('/v1/integrations/setup/state', {
      headers: authHeaders('admin-a', tenantId()),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { phase: string; coreCrmId: string };
    expect(typeof body.phase).toBe('string');
    expect(typeof body.coreCrmId).toBe('string');
  });

  it.skipIf(!dbIntegrationReady())('returns core CRM readiness snapshot', async () => {
    const res = await app.request('/v1/integrations/core-crm/readiness', {
      headers: authHeaders('admin-a', tenantId()),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { coreCrmId: string; snapshot: unknown };
    expect(typeof body.coreCrmId).toBe('string');
    expect(body.snapshot).toBeTruthy();
  });
});
