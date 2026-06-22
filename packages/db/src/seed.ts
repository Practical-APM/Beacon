import { seedTenants } from './seed-helpers.js';
import { seedDemoOperationalData } from './seed-demo-data.js';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://beacon:beacon@localhost:5433/beacon';
  const seeded = await seedTenants(connectionString);
  for (const tenant of seeded) {
    console.log(`Seeded tenant: ${tenant.slug} (${tenant.id})`);
  }
  const demo = await seedDemoOperationalData(connectionString);
  if (demo) {
    console.log(`Seeded demo project: ${demo.projectId}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
