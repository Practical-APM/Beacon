import { seedLoadTestData } from './seed-load-test-data.js';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://beacon:beacon@localhost:5433/beacon';
  const started = Date.now();
  const result = await seedLoadTestData(connectionString);
  if (!result) {
    console.error('Load test seed failed: tenant not found');
    process.exit(1);
  }

  console.log(`Load test seed complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`Tenant: ${result.tenantId}`);
  console.log(`Projects: ${result.projectIds.length}`);
  console.log(`Tasks: ${result.taskCount}`);
  console.log(`Events: ${result.eventCount}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Load test seed failed:', error);
  process.exit(1);
});
