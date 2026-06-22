import type { Database } from '@beacon/db';
import { logger } from '../../lib/logger.js';
import { runDailyDigests } from './digest.js';

const DIGEST_CHECK_MS = 60 * 1000;

let started = false;
let handle: NodeJS.Timeout | null = null;

export function startNotificationScheduler(db: Database, enabled: boolean): void {
  if (!enabled) {
    logger.info('Notification scheduler disabled');
    return;
  }
  if (started) return;
  started = true;

  handle = setInterval(() => {
    void runDailyDigests(db)
      .then((sent) => {
        if (sent > 0) {
          logger.info('Daily digests sent', { count: sent });
        }
      })
      .catch((error) => {
        logger.error('Notification scheduler tick failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }, DIGEST_CHECK_MS);

  logger.info('Notification scheduler started', { intervalMs: DIGEST_CHECK_MS });
}

export function stopNotificationScheduler(): void {
  if (handle) clearInterval(handle);
  handle = null;
  started = false;
}
