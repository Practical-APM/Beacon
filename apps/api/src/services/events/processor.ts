import { createDb, events, integrations, tasks, withTenantContext, type Database } from '@beacon/db';
import {
  clampSourceUpdatedAt,
  resolveExternalEventId,
  validateCanonicalEvent,
  type CanonicalEvent,
} from '@beacon/shared/events';
import { and, eq } from 'drizzle-orm';
import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';
import { incrementMetric } from './metrics.js';

export interface ProcessEventResult {
  status: 'inserted' | 'deduplicated' | 'dropped';
  eventId?: string;
}

export async function processCanonicalEvent(
  eventInput: CanonicalEvent,
  db: Database = createDb(env.DATABASE_URL).db,
): Promise<ProcessEventResult> {
  const event = validateCanonicalEvent(eventInput);
  const externalEventId = resolveExternalEventId(event);

  const connected = await isIntegrationConnected(db, event.tenantId, event.source);
  if (!connected) {
    logger.info('Dropped event for disconnected integration', {
      tenantId: event.tenantId,
      source: event.source,
      eventType: event.eventType,
    });
    return { status: 'dropped' };
  }

  const occurredAt = clampSourceUpdatedAt(event.sourceUpdatedAt);

  const inserted = await withTenantContext(db, event.tenantId, async () => {
    const rows = await db
      .insert(events)
      .values({
        tenantId: event.tenantId,
        projectId: event.projectId ?? null,
        eventSchemaVersion: event.eventSchemaVersion,
        eventType: event.eventType,
        source: event.source,
        externalId: event.externalId ?? null,
        externalEventId,
        payload: event.payload,
        occurredAt,
      })
      .onConflictDoNothing({
        target: [events.tenantId, events.source, events.externalEventId],
      })
      .returning({ id: events.id });

    return rows[0] ?? null;
  });

  if (!inserted) {
    await incrementMetric('deduplicated');
    return { status: 'deduplicated' };
  }

  await applyEntitySideEffects(db, event);
  if (event.eventType === 'slack_message') {
    const { applySlackMessageSideEffect } = await import('../slack/event-handler.js');
    await applySlackMessageSideEffect(db, event);
  }
  if (event.projectId) {
    const { scheduleRiskEvaluation } = await import('../risk/engine.js');
    scheduleRiskEvaluation(db, event.tenantId, event.projectId);
  }
  await incrementMetric('processed');
  await incrementMetric('lastProcessedAt', 1);
  const { invalidateTenantDashboardCache } = await import('../../lib/dashboard-cache.js');
  await invalidateTenantDashboardCache(event.tenantId);
  return { status: 'inserted', eventId: inserted.id };
}

async function isIntegrationConnected(
  db: Database,
  tenantId: string,
  source: CanonicalEvent['source'],
): Promise<boolean> {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select({ status: integrations.status })
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.source, source)))
      .limit(1);
    if (!row) return false;
    return row.status !== 'disconnected';
  });
}

async function applyEntitySideEffects(db: Database, event: CanonicalEvent): Promise<void> {
  if (event.eventType === 'task_completed' && event.externalId) {
    const externalId = event.externalId;
    await withTenantContext(db, event.tenantId, async () => {
      await db
        .update(tasks)
        .set({
          status: 'done',
          statusCategory: 'done',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.tenantId, event.tenantId),
            eq(tasks.externalSource, event.source),
            eq(tasks.externalId, externalId),
          ),
        );
    });
  }
}

export async function processCanonicalEventOrThrow(event: CanonicalEvent): Promise<ProcessEventResult> {
  try {
    return await processCanonicalEvent(event);
  } catch (error) {
    await incrementMetric('failed');
    throw error;
  }
}
