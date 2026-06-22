import { sql } from 'drizzle-orm';
import type { Database } from './index.js';

export async function withTenantContext<T>(
  db: Database,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await db.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
  return fn();
}

export async function clearTenantContext(db: Database): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_tenant_id', '', true)`);
}
