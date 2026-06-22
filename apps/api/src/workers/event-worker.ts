import { Worker, type Job } from 'bullmq';
import type { CanonicalEvent } from '@beacon/shared/events';
import { env } from '../env.js';
import { logger } from '../lib/logger.js';
import {
  QUEUE_NAMES,
  getBulkQueue,
  getDlqQueue,
  getQueueConnection,
  getRealtimeQueue,
  moveJobToDlq,
} from '../lib/queue.js';
import { getIngestionMetrics, setQueueDepth } from '../services/events/metrics.js';
import { processCanonicalEventOrThrow } from '../services/events/processor.js';

let realtimeWorker: Worker | null = null;
let bulkWorker: Worker | null = null;

async function handleJob(job: Job) {
  const event = job.data as CanonicalEvent;
  try {
    await processCanonicalEventOrThrow(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if ((job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 3)) {
      await moveJobToDlq(event, message);
    }
    throw error;
  }
}

async function refreshQueueDepthMetrics(): Promise<void> {
  const [realtime, bulk, dlq] = await Promise.all([
    getRealtimeQueue().getJobCounts('waiting', 'active', 'delayed'),
    getBulkQueue().getJobCounts('waiting', 'active', 'delayed'),
    getDlqQueue().getJobCounts('waiting', 'active', 'delayed', 'failed'),
  ]);

  await setQueueDepth('realtimeWaiting', (realtime.waiting ?? 0) + (realtime.active ?? 0) + (realtime.delayed ?? 0));
  await setQueueDepth('bulkWaiting', (bulk.waiting ?? 0) + (bulk.active ?? 0) + (bulk.delayed ?? 0));
  await setQueueDepth('dlqDepth', (dlq.waiting ?? 0) + (dlq.failed ?? 0) + (dlq.delayed ?? 0));
}

export async function startEventWorkers(): Promise<void> {
  if (!env.EVENT_WORKERS_ENABLED) {
    logger.info('Event workers disabled');
    return;
  }

  const connection = getQueueConnection();

  if (!realtimeWorker) {
    realtimeWorker = new Worker(QUEUE_NAMES.realtime, handleJob, {
      connection,
      concurrency: 5,
    });
    realtimeWorker.on('failed', (job, error) => {
      logger.error('Realtime event job failed', {
        jobId: job?.id,
        message: error.message,
      });
    });
  }

  if (!bulkWorker) {
    bulkWorker = new Worker(QUEUE_NAMES.bulk, handleJob, {
      connection,
      concurrency: 2,
    });
    bulkWorker.on('failed', (job, error) => {
      logger.error('Bulk event job failed', {
        jobId: job?.id,
        message: error.message,
      });
    });
  }

  setInterval(() => {
    void refreshQueueDepthMetrics();
  }, 10_000);

  await refreshQueueDepthMetrics();
  logger.info('Event workers started', {
    realtimeQueue: QUEUE_NAMES.realtime,
    bulkQueue: QUEUE_NAMES.bulk,
    dlqQueue: QUEUE_NAMES.dlq,
  });
}

export async function stopEventWorkers(): Promise<void> {
  await Promise.all([realtimeWorker?.close(), bulkWorker?.close()]);
  realtimeWorker = null;
  bulkWorker = null;
}

export async function listDlqJobs(limit = 50) {
  const dlq = getDlqQueue();
  const jobs = await dlq.getJobs(['waiting', 'failed', 'delayed'], 0, limit - 1, true);
  return jobs
    .filter((job) => job.name === 'dead-letter')
    .map((job) => ({
      id: job.id,
      name: job.name,
      failedReason: job.failedReason,
      data: job.data,
      timestamp: job.timestamp,
    }));
}

export async function replayDlqJob(jobId: string): Promise<boolean> {
  const dlq = getDlqQueue();
  const job = await dlq.getJob(jobId);
  if (!job || job.name !== 'dead-letter') return false;

  const event = job.data as CanonicalEvent;
  await getRealtimeQueue().add(event.eventType, {
    ...event,
    payload: Object.fromEntries(
      Object.entries(event.payload ?? {}).filter(([key]) => key !== '_dlqError'),
    ),
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
  await job.remove();
  await refreshQueueDepthMetrics();
  return true;
}

export async function getWorkerMetrics() {
  await refreshQueueDepthMetrics();
  return getIngestionMetrics();
}
