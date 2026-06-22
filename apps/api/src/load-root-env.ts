import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

/** Load monorepo root `.env` for local dev (Turbo does not inject it into the API process). */
export function loadRootEnv(): void {
  const rootEnv = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../.env',
  );

  if (existsSync(rootEnv)) {
    loadEnvFile(rootEnv);
  }
}
