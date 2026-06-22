import { createDb } from '@beacon/db';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { initTelemetry } from './lib/telemetry.js';
import { startNotificationScheduler } from './services/notifications/scheduler.js';
import { startRiskScheduler } from './services/risk/scheduler.js';
import { startEventWorkers } from './workers/event-worker.js';

async function main() {
  await initTelemetry();
  await startEventWorkers();

  const { db } = createDb(env.DATABASE_URL);
  startRiskScheduler(db, env.RISK_SCHEDULER_ENABLED);
  startNotificationScheduler(db, env.NOTIFICATION_SCHEDULER_ENABLED);

  const app = createApp();

  serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      logger.info('API server started', {
        port: info.port,
        env: env.NODE_ENV,
      });
    },
  );
}

main().catch((error) => {
  logger.error('Failed to start API server', { message: String(error) });
  process.exit(1);
});
