import { logger } from './logger.js';

export function runInBackground(
  jobName: string,
  task: () => Promise<unknown>,
  context?: Record<string, unknown>,
): void {
  void task().catch((error) => {
    logger.error('Background job failed', {
      job: jobName,
      ...context,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}
