import { checkDatabaseHealth, closeDb } from '@beacon/db';
import { seedDemoOperationalData, seedGlobexDemoOperationalData } from '@beacon/db/seed-demo-data';
import { seedTenants } from '@beacon/db/seed-helpers';
import { clearIntegrationSyncLocks } from './integration-helpers.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://beacon:beacon@localhost:5433/beacon';

function isCiEnvironment(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

export default async function globalSetup(): Promise<void> {
  process.env.DB_INTEGRATION_READY = '0';
  process.env.TEST_TENANT_ACME_ID = '';
  process.env.TEST_TENANT_GLOBEX_ID = '';

  const health = await checkDatabaseHealth(DATABASE_URL);
  if (health !== 'ok') {
    const message = `Integration tests require Postgres at ${DATABASE_URL}. Run make up && make db-migrate && make db-seed locally.`;
    if (isCiEnvironment()) {
      throw new Error(message);
    }
    return;
  }

  try {
    const seeded = await seedTenants(DATABASE_URL);
    const acmeId = seeded.find((tenant) => tenant.slug === 'acme-demo')?.id ?? '';
    const globexId = seeded.find((tenant) => tenant.slug === 'globex-demo')?.id ?? '';
    process.env.TEST_TENANT_ACME_ID = acmeId;
    process.env.TEST_TENANT_GLOBEX_ID = globexId;
    await seedDemoOperationalData(DATABASE_URL, 'acme-demo');
    await seedGlobexDemoOperationalData(DATABASE_URL);
    if (acmeId) await clearIntegrationSyncLocks(acmeId);
    if (globexId) await clearIntegrationSyncLocks(globexId);
    process.env.DB_INTEGRATION_READY = '1';
  } catch (error) {
    if (isCiEnvironment()) {
      throw error;
    }
  } finally {
    await closeDb();
  }
}
