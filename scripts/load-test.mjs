#!/usr/bin/env node
/**
 * Lightweight load smoke test for pilot NFR validation.
 * Usage: node scripts/load-test.mjs [baseUrl] [tenantAuthToken] [tenantId]
 */
const baseUrl = process.argv[2] ?? process.env.API_URL ?? 'http://localhost:3001';
const externalAuthId = process.argv[3] ?? 'admin-a';
const tenantId = process.argv[4] ?? process.env.TENANT_ID ?? '';

const API_P95_MS = 2000;

if (!tenantId) {
  console.error('Provide tenant id as 4th arg or TENANT_ID env var');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer dev:${externalAuthId}`,
  'x-tenant-id': tenantId,
};

async function timedFetch(path) {
  const start = performance.now();
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const durationMs = performance.now() - start;
  return { path, status: res.status, durationMs };
}

const paths = ['/health', '/v1/dashboard', '/v1/projects?limit=20', '/v1/risks?limit=20'];
const iterations = 20;
const samples = [];

for (let i = 0; i < iterations; i += 1) {
  for (const path of paths) {
    samples.push(await timedFetch(path));
  }
}

const byPath = new Map();
for (const sample of samples) {
  const bucket = byPath.get(sample.path) ?? [];
  bucket.push(sample.durationMs);
  byPath.set(sample.path, bucket);
}

console.log(`Load test: ${iterations} iterations x ${paths.length} endpoints`);
let failed = false;

for (const [path, durations] of byPath.entries()) {
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
  const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const isApiPath = path.startsWith('/v1/');
  const pass = !isApiPath || p95 <= API_P95_MS;
  if (isApiPath && !pass) failed = true;
  console.log(
    `${path} avg=${avg.toFixed(0)}ms p95=${p95.toFixed(0)}ms${isApiPath ? (pass ? ' PASS' : ' FAIL') : ''}`,
  );
}

if (failed) {
  console.error(`\nNFR failed: API p95 must be <= ${API_P95_MS}ms`);
  process.exit(1);
}

console.log('\nNFR passed: all API endpoints under p95 threshold');
