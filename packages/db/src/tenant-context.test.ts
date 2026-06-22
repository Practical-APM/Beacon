import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearTenantContext, closeDb, createDb, withTenantContext } from './index.js';
import { DATABASE_URL, isCiEnvironment, requireDatabaseHealth } from './test-support.js';

describe('withTenantContext', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await requireDatabaseHealth();
      dbAvailable = true;
    } catch (error) {
      if (isCiEnvironment()) throw error;
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it.skipIf(!dbAvailable)('sets app.current_tenant_id for the transaction scope', async () => {
    const { db } = createDb(DATABASE_URL);
    const tenantId = '00000000-0000-4000-8000-000000000001';

    await withTenantContext(db, tenantId, async () => {
      const rows = await db.execute<{ value: string }>(
        sql`SELECT current_setting('app.current_tenant_id', true) AS value`,
      );
      expect(rows[0]?.value).toBe(tenantId);
    });

    await clearTenantContext(db);
    const cleared = await db.execute<{ value: string }>(
      sql`SELECT current_setting('app.current_tenant_id', true) AS value`,
    );
    expect(cleared[0]?.value ?? '').toBe('');
  });
});
