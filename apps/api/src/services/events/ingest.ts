import type { CanonicalEvent, EventQueue } from '@beacon/shared/events';
import { resolveExternalEventId, validateCanonicalEvent } from '@beacon/shared/events';
import { enqueueCanonicalEvent } from '../../lib/queue.js';
import { processCanonicalEvent } from './processor.js';

export async function publishEvent(
  event: CanonicalEvent,
  queue: EventQueue = 'realtime',
): Promise<{ queued: boolean; jobId: string | null; externalEventId: string }> {
  const validated = validateCanonicalEvent(event);
  const externalEventId = resolveExternalEventId(validated);
  const jobId = await enqueueCanonicalEvent(validated, queue);
  return { queued: Boolean(jobId), jobId, externalEventId };
}

export async function publishEvents(
  events: CanonicalEvent[],
  queue: EventQueue = 'bulk',
): Promise<{ queued: number }> {
  let queued = 0;
  for (const event of events) {
    const result = await publishEvent(event, queue);
    if (result.queued) queued += 1;
  }
  return { queued };
}

export async function ingestEventSynchronously(event: CanonicalEvent): Promise<{
  status: 'inserted' | 'deduplicated' | 'dropped';
  eventId?: string;
}> {
  return processCanonicalEvent(event);
}
