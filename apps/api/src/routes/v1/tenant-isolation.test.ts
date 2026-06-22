import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import {
  authHeaders,
  dbIntegrationReady,
  testTenantAcmeId,
  testTenantGlobexId,
} from '../../test/integration-env.js';

describe('tenant isolation and RBAC', () => {
  const app = createApp();
  let tenantAId = '';
  let tenantBId = '';
  let globexProjectId = '';

  beforeAll(async () => {
    tenantAId = testTenantAcmeId();
    tenantBId = testTenantGlobexId();

    if (dbIntegrationReady() && tenantBId) {
      const res = await app.request('/v1/projects?limit=1', {
        headers: authHeaders('admin-b', tenantBId),
      });
      if (res.ok) {
        const body = (await res.json()) as { data: Array<{ id: string }> };
        globexProjectId = body.data[0]?.id ?? '';
      }
    }
  });

  it.skipIf(!dbIntegrationReady())(
    'blocks cross-tenant access when x-tenant-id does not match membership',
    async () => {
      const res = await app.request(`/v1/tenants/${tenantBId}`, {
        headers: authHeaders('admin-a', tenantBId),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as { title: string };
      expect(body.title).toBe('Forbidden');
    },
  );

  it.skipIf(!dbIntegrationReady())(
    'allows tenant member to read their organization',
    async () => {
      const res = await app.request(`/v1/tenants/${tenantAId}`, {
        headers: authHeaders('admin-a', tenantAId),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { tenant: { id: string }; role: string };
      expect(body.tenant.id).toBe(tenantAId);
      expect(body.role).toBe('admin');
    },
  );

  it.skipIf(!dbIntegrationReady())(
    'blocks contributor from admin settings update',
    async () => {
      const res = await app.request(`/v1/tenants/${tenantAId}`, {
        method: 'PATCH',
        headers: authHeaders('contributor-a', tenantAId),
        body: JSON.stringify({ name: 'Renamed Org' }),
      });

      expect(res.status).toBe(403);
    },
  );

  it.skipIf(!dbIntegrationReady())(
    'blocks contributor from creating invitations',
    async () => {
      const res = await app.request(`/v1/tenants/${tenantAId}/invitations`, {
        method: 'POST',
        headers: authHeaders('contributor-a', tenantAId),
        body: JSON.stringify({ email: 'new-user@example.com', role: 'contributor' }),
      });

      expect(res.status).toBe(403);
    },
  );

  it.skipIf(!dbIntegrationReady())(
    'allows admin to invite a user',
    async () => {
      const res = await app.request(`/v1/tenants/${tenantAId}/invitations`, {
        method: 'POST',
        headers: authHeaders('admin-a', tenantAId),
        body: JSON.stringify({ email: 'invited@example.com', role: 'contributor' }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { invitation: { email: string } };
      expect(body.invitation.email).toBe('invited@example.com');
    },
  );

  it.skipIf(!dbIntegrationReady() || !globexProjectId)(
    'returns 404 when reading another tenant project by UUID',
    async () => {
      const res = await app.request(`/v1/projects/${globexProjectId}`, {
        headers: authHeaders('admin-a', tenantAId),
      });

      expect(res.status).toBe(404);
    },
  );

  it.skipIf(!dbIntegrationReady() || !globexProjectId)(
    'returns 404 when listing risks from another tenant project context',
    async () => {
      const projectRes = await app.request(`/v1/projects/${globexProjectId}?detail=full`, {
        headers: authHeaders('admin-b', tenantBId),
      });
      expect(projectRes.status).toBe(200);
      const projectBody = (await projectRes.json()) as { openRisks: Array<{ id: string }> };
      const riskId = projectBody.openRisks[0]?.id;
      if (!riskId) return;

      const crossTenantRisk = await app.request(`/v1/risks/${riskId}`, {
        headers: authHeaders('admin-a', tenantAId),
      });
      expect(crossTenantRisk.status).toBe(404);
    },
  );

  it.skipIf(!dbIntegrationReady())(
    'scopes dashboard metrics to the authenticated tenant only',
    async () => {
      const acmeProjectsRes = await app.request('/v1/projects?limit=20', {
        headers: authHeaders('admin-a', tenantAId),
      });
      const globexProjectsRes = await app.request('/v1/projects?limit=20', {
        headers: authHeaders('admin-b', tenantBId),
      });

      expect(acmeProjectsRes.status).toBe(200);
      expect(globexProjectsRes.status).toBe(200);

      const acmeProjects = (await acmeProjectsRes.json()) as { data: Array<{ id: string }> };
      const globexProjects = (await globexProjectsRes.json()) as { data: Array<{ id: string }> };
      const acmeIds = new Set(acmeProjects.data.map((project) => project.id));
      const overlap = globexProjects.data.some((project) => acmeIds.has(project.id));
      expect(overlap).toBe(false);
    },
  );
});
