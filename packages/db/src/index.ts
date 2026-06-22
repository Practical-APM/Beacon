import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>['db'];

let cached: { db: ReturnType<typeof drizzle<typeof schema>>; client: postgres.Sql } | null = null;

export function createDb(connectionString: string) {
  if (cached) {
    return cached;
  }

  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(client, { schema });
  cached = { db, client };
  return cached;
}

export async function checkDatabaseHealth(connectionString: string): Promise<'ok' | 'error'> {
  try {
    const { client } = createDb(connectionString);
    await client`SELECT 1`;
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.client.end();
    cached = null;
  }
}

export * from './schema/index.js';
export * from './tenant-context.js';
export * from './seed-helpers.js';
export * from './seed-demo-data.js';
