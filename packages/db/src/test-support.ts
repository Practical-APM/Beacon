import { checkDatabaseHealth } from './index.js';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://beacon:beacon@localhost:5433/beacon';

export function isCiEnvironment(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

export async function requireDatabaseHealth(): Promise<void> {
  const health = await checkDatabaseHealth(DATABASE_URL);
  if (health === 'ok') return;
  const message = `Database unavailable at ${DATABASE_URL}. Run make up && make db-migrate && make db-seed.`;
  if (isCiEnvironment()) {
    throw new Error(message);
  }
}
