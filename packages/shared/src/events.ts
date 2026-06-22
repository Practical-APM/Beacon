import { createHash } from 'node:crypto';
import { z } from 'zod';
import { INTEGRATION_SOURCES } from './constants.js';

export const EVENT_SCHEMA_VERSION = 1 as const;

export const EVENT_TYPES = [
  'task_updated',
  'task_completed',
  'milestone_updated',
  'customer_updated',
  'slack_message',
  'calendar_meeting',
  'integration_health',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_QUEUES = ['realtime', 'bulk'] as const;
export type EventQueue = (typeof EVENT_QUEUES)[number];

export const canonicalEventSchema = z.object({
  eventSchemaVersion: z.literal(EVENT_SCHEMA_VERSION).default(EVENT_SCHEMA_VERSION),
  eventType: z.enum(EVENT_TYPES),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  source: z.enum(INTEGRATION_SOURCES),
  externalId: z.string().nullable().optional(),
  externalEventId: z.string().min(1).optional(),
  sourceUpdatedAt: z.string().datetime(),
  payload: z.record(z.unknown()).default({}),
});

export type CanonicalEvent = z.infer<typeof canonicalEventSchema>;

export function validateCanonicalEvent(input: unknown): CanonicalEvent {
  return canonicalEventSchema.parse(input);
}

export function computeEventContentHash(event: Omit<CanonicalEvent, 'externalEventId'>): string {
  const hash = createHash('sha256');
  hash.update(
    JSON.stringify({
      tenantId: event.tenantId,
      source: event.source,
      eventType: event.eventType,
      externalId: event.externalId ?? null,
      sourceUpdatedAt: event.sourceUpdatedAt,
      payload: event.payload,
    }),
  );
  return `hash:${hash.digest('hex').slice(0, 32)}`;
}

export function resolveExternalEventId(event: CanonicalEvent): string {
  if (event.externalEventId?.trim()) {
    return event.externalEventId.trim();
  }
  return computeEventContentHash(event);
}

export function buildTaskExternalEventId(params: {
  source: (typeof INTEGRATION_SOURCES)[number];
  eventType: 'task_updated' | 'task_completed';
  externalId: string;
  sourceUpdatedAt: string;
}): string {
  return `${params.source}:${params.eventType}:${params.externalId}:${params.sourceUpdatedAt}`;
}

export function clampSourceUpdatedAt(sourceUpdatedAt: string, now = new Date()): Date {
  const parsed = new Date(sourceUpdatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return now;
  }
  if (parsed.getTime() > now.getTime() + 60_000) {
    return now;
  }
  return parsed;
}

export function mapJiraWebhookToEvent(params: {
  tenantId: string;
  projectId?: string | null;
  webhookEvent: string;
  issue?: {
    id?: string;
    key?: string;
    fields?: {
      updated?: string;
      status?: { statusCategory?: { key?: string } | null };
    };
  } | null;
}): CanonicalEvent {
  const issueId = params.issue?.id ?? 'unknown';
  const updated = params.issue?.fields?.updated ?? new Date().toISOString();
  const statusCategory = params.issue?.fields?.status?.statusCategory?.key;
  const eventType: EventType =
    statusCategory === 'done' || params.webhookEvent.includes('deleted')
      ? 'task_completed'
      : 'task_updated';

  return validateCanonicalEvent({
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    eventType,
    tenantId: params.tenantId,
    projectId: params.projectId ?? null,
    source: 'jira',
    externalId: issueId,
    externalEventId: buildTaskExternalEventId({
      source: 'jira',
      eventType,
      externalId: issueId,
      sourceUpdatedAt: updated,
    }),
    sourceUpdatedAt: updated,
    payload: {
      webhookEvent: params.webhookEvent,
      issueId,
      issueKey: params.issue?.key ?? null,
    },
  });
}

export function buildIntegrationHealthEvent(params: {
  tenantId: string;
  source: (typeof INTEGRATION_SOURCES)[number];
  status: string;
  recordsProcessed?: number;
  jobType?: string;
}): CanonicalEvent {
  const now = new Date().toISOString();
  return validateCanonicalEvent({
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    eventType: 'integration_health',
    tenantId: params.tenantId,
    source: params.source,
    externalEventId: `${params.source}:integration_health:${now}`,
    sourceUpdatedAt: now,
    payload: {
      status: params.status,
      recordsProcessed: params.recordsProcessed ?? 0,
      jobType: params.jobType ?? 'bulk',
    },
  });
}

export function buildTaskUpdatedEvent(params: {
  tenantId: string;
  projectId?: string | null;
  source: (typeof INTEGRATION_SOURCES)[number];
  externalId: string;
  sourceUpdatedAt: string;
  payload?: Record<string, unknown>;
}): CanonicalEvent {
  return validateCanonicalEvent({
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    eventType: 'task_updated',
    tenantId: params.tenantId,
    projectId: params.projectId ?? null,
    source: params.source,
    externalId: params.externalId,
    externalEventId: buildTaskExternalEventId({
      source: params.source,
      eventType: 'task_updated',
      externalId: params.externalId,
      sourceUpdatedAt: params.sourceUpdatedAt,
    }),
    sourceUpdatedAt: params.sourceUpdatedAt,
    payload: params.payload ?? {},
  });
}

export function buildSlackMessageEvent(params: {
  tenantId: string;
  projectId?: string | null;
  channelId: string;
  messageTs: string;
  sourceUpdatedAt: string;
  payload?: Record<string, unknown>;
}): CanonicalEvent {
  return validateCanonicalEvent({
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    eventType: 'slack_message',
    tenantId: params.tenantId,
    projectId: params.projectId ?? null,
    source: 'slack',
    externalId: `${params.channelId}:${params.messageTs}`,
    externalEventId: `slack:message:${params.channelId}:${params.messageTs}`,
    sourceUpdatedAt: params.sourceUpdatedAt,
    payload: params.payload ?? {},
  });
}

export function buildCalendarMeetingEvent(params: {
  tenantId: string;
  projectId?: string | null;
  calendarId: string;
  meetingId: string;
  sourceUpdatedAt: string;
  payload?: Record<string, unknown>;
}): CanonicalEvent {
  return validateCanonicalEvent({
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    eventType: 'calendar_meeting',
    tenantId: params.tenantId,
    projectId: params.projectId ?? null,
    source: 'google_calendar',
    externalId: params.meetingId,
    externalEventId: `google_calendar:meeting:${params.calendarId}:${params.meetingId}`,
    sourceUpdatedAt: params.sourceUpdatedAt,
    payload: params.payload ?? {},
  });
}
