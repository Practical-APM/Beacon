import { seedDemoOperationalData } from '@beacon/db/seed-demo-data';

export { clearIntegrationSyncLocks, clearProjectInsightCache } from './integration-helpers.js';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://beacon:beacon@localhost:5433/beacon';

export function dbIntegrationReady(): boolean {
  return process.env.DB_INTEGRATION_READY === '1';
}

export function testTenantAcmeId(): string {
  return process.env.TEST_TENANT_ACME_ID ?? '';
}

export function testTenantGlobexId(): string {
  return process.env.TEST_TENANT_GLOBEX_ID ?? '';
}

export function isCiEnvironment(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

export function authHeaders(externalAuthId: string, tenantId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer dev:${externalAuthId}`,
    'Content-Type': 'application/json',
  };
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }
  return headers;
}

export async function seedDemoTenantId(tenantSlug = 'acme-demo'): Promise<string> {
  const context = await seedDemoContext(tenantSlug);
  return context.tenantId;
}

export async function seedDemoContext(
  tenantSlug = 'acme-demo',
): Promise<{ tenantId: string; projectId: string; riskId: string }> {
  if (!dbIntegrationReady()) return { tenantId: '', projectId: '', riskId: '' };
  try {
    const demo = await seedDemoOperationalData(DATABASE_URL, tenantSlug);
    return {
      tenantId: demo?.tenantId ?? testTenantAcmeId(),
      projectId: demo?.projectId ?? '',
      riskId: demo?.riskId ?? '',
    };
  } catch (error) {
    if (isCiEnvironment()) throw error;
    return { tenantId: '', projectId: '', riskId: '' };
  }
}
