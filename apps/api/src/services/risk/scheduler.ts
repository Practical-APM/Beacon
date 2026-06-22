import type { Database } from '@beacon/db';
import { logger } from '../../lib/logger.js';
import { runScheduledRiskEvaluations } from './engine.js';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let schedulerStarted = false;
let schedulerHandle: NodeJS.Timeout | null = null;

export function startRiskScheduler(db: Database, enabled: boolean): void {
  if (!enabled) {
    logger.info('Risk evaluation scheduler disabled');
    return;
  }

  if (schedulerStarted) return;
  schedulerStarted = true;

  schedulerHandle = setInterval(() => {
    void runScheduledRiskEvaluations(db).catch((error) => {
      logger.error('Risk scheduler tick failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }, SIX_HOURS_MS);

  logger.info('Risk evaluation scheduler started', { intervalMs: SIX_HOURS_MS });
}

export function stopRiskScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
  schedulerStarted = false;
}
