import { Queue } from 'bullmq';
import type { CanonicalEvent, EventQueue } from '@beacon/shared/events';
import { env } from '../env.js';

export const QUEUE_NAMES = {
  realtime: 'beacon-events-realtime',
  bulk: 'beacon-events-bulk',
  dlq: 'beacon-events-dlq',
} as const;

let realtimeQueue: Queue | null = null;
let bulkQueue: Queue | null = null;
let dlqQueue: Queue | null = null;

function getConnectionOptions() {
  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  };
}

function getQueue(name: typeof QUEUE_NAMES.realtime | typeof QUEUE_NAMES.bulk | typeof QUEUE_NAMES.dlq) {
  const connection = getConnectionOptions();
  if (name === QUEUE_NAMES.realtime) {
    if (!realtimeQueue) realtimeQueue = new Queue(name, { connection });
    return realtimeQueue;
  }
  if (name === QUEUE_NAMES.bulk) {
    if (!bulkQueue) bulkQueue = new Queue(name, { connection });
    return bulkQueue;
  }
  if (!dlqQueue) dlqQueue = new Queue(name, { connection });
  return dlqQueue;
}

export function getQueueConnection() {
  return getConnectionOptions();
}

export function getRealtimeQueue() {
  return getQueue(QUEUE_NAMES.realtime);
}

export function getBulkQueue() {
  return getQueue(QUEUE_NAMES.bulk);
}

export function getDlqQueue() {
  return getQueue(QUEUE_NAMES.dlq);
}

export async function enqueueCanonicalEvent(
  event: CanonicalEvent,
  queue: EventQueue = 'realtime',
): Promise<string | null> {
  const target = queue === 'bulk' ? getBulkQueue() : getRealtimeQueue();
  const job = await target.add(event.eventType, event, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: false,
  });
  return job.id ?? null;
}

export async function moveJobToDlq(event: CanonicalEvent, error: string): Promise<void> {
  const dlq = getDlqQueue();
  await dlq.add(
    'dead-letter',
    { ...event, payload: { ...event.payload, _dlqError: error } },
    {
      removeOnComplete: false,
      removeOnFail: false,
    },
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all([realtimeQueue?.close(), bulkQueue?.close(), dlqQueue?.close()]);
  realtimeQueue = null;
  bulkQueue = null;
  dlqQueue = null;
}
