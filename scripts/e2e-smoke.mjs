#!/usr/bin/env node
/**
 * API end-to-end smoke test for pilot walkthrough validation.
 * Simulates sign-in → setup → dashboard → project detail without a browser.
 *
 * Usage:
 *   node scripts/e2e-smoke.mjs [baseUrl] [externalAuthId] [tenantId]
 *   make e2e-smoke TENANT_ID=<uuid>
 */
const baseUrl = process.argv[2] ?? process.env.API_URL ?? 'http://localhost:3001';
const externalAuthId = process.argv[3] ?? 'admin-a';
const tenantId = process.argv[4] ?? process.env.TENANT_ID ?? '';

if (!tenantId) {
  console.error('Provide tenant id as 4th arg or TENANT_ID env var');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer dev:${externalAuthId}`,
  'x-tenant-id': tenantId,
  'Content-Type': 'application/json',
};

const steps = [];
let failed = false;

async function step(name, fn) {
  try {
    await fn();
    steps.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    steps.push({ name, ok: false, message });
    console.error(`✗ ${name}: ${message}`);
  }
}

async function json(path, init) {
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

console.log(`E2E smoke: ${baseUrl} tenant=${tenantId} user=${externalAuthId}\n`);

await step('health check', async () => {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error(`health returned ${res.status}`);
});

await step('session / me', async () => {
  const body = await json('/v1/me');
  if (!body.user?.email) throw new Error('missing user email');
  if (!body.memberships?.length) throw new Error('missing memberships');
});

await step('setup state', async () => {
  const body = await json('/v1/integrations/setup/state');
  if (!body.phase) throw new Error('missing setup phase');
});

await step('core CRM readiness', async () => {
  const body = await json('/v1/integrations/core-crm/readiness');
  if (!body.coreCrmId) throw new Error('missing coreCrmId');
});

await step('dashboard summary', async () => {
  const body = await json('/v1/dashboard');
  if (typeof body.activeProjects !== 'number') throw new Error('missing activeProjects');
});

let projectId = '';
await step('project list', async () => {
  const body = await json('/v1/projects?limit=5');
  if (!Array.isArray(body.data)) throw new Error('missing project data');
  if (body.data.length === 0) throw new Error('no projects returned');
  projectId = body.data[0].id;
});

await step('project detail', async () => {
  if (!projectId) throw new Error('no project id from list step');
  const body = await json(`/v1/projects/${projectId}?detail=full`);
  if (!body.project?.id) throw new Error('missing project detail');
});

await step('risk feed', async () => {
  const body = await json('/v1/risks?limit=5');
  if (!Array.isArray(body.data)) throw new Error('missing risk data');
});

await step('contributor project scoping', async () => {
  const contributorHeaders = {
    Authorization: 'Bearer dev:contributor-a',
    'x-tenant-id': tenantId,
  };
  const meRes = await fetch(`${baseUrl}/v1/me`, { headers: contributorHeaders });
  const me = await meRes.json();
  if (!meRes.ok || !me.user?.email?.includes('@acme-demo.test')) {
    throw new Error(`contributor email not seeded: ${me.user?.email ?? 'unknown'}`);
  }

  const projectsRes = await fetch(`${baseUrl}/v1/projects?limit=20`, { headers: contributorHeaders });
  const projects = await projectsRes.json();
  if (!projectsRes.ok) throw new Error(`contributor projects returned ${projectsRes.status}`);
  for (const project of projects.data ?? []) {
    if (project.ownerEmail?.toLowerCase() !== me.user.email.toLowerCase()) {
      throw new Error(`contributor saw project owned by ${project.ownerEmail}`);
    }
  }
});

await step('public unsubscribe route', async () => {
  const res = await fetch(`${baseUrl}/v1/notifications/unsubscribe`);
  if (res.status !== 400) throw new Error(`expected 400 without token, got ${res.status}`);
});

console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length} steps passed`);
if (failed) {
  process.exit(1);
}
console.log('E2E smoke passed');
