import { describe, expect, it } from 'vitest';
import {
  clampSourceUpdatedAt,
  computeEventContentHash,
  buildTaskExternalEventId,
  buildTaskUpdatedEvent,
  mapJiraWebhookToEvent,
  resolveExternalEventId,
  validateCanonicalEvent,
} from './events.js';

describe('canonical events', () => {
  it('validates canonical event payloads', () => {
    const event = validateCanonicalEvent({
      eventType: 'task_updated',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      source: 'jira',
      sourceUpdatedAt: '2026-06-12T00:00:00.000Z',
      payload: { issueId: '10001' },
    });
    expect(event.eventSchemaVersion).toBe(1);
    expect(event.eventType).toBe('task_updated');
  });

  it('deduplicates using content hash when externalEventId is absent', () => {
    const base = {
      eventSchemaVersion: 1 as const,
      eventType: 'task_updated' as const,
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      source: 'jira' as const,
      sourceUpdatedAt: '2026-06-12T00:00:00.000Z',
      payload: { issueId: '10001' },
    };
    const hash = computeEventContentHash(base);
    expect(resolveExternalEventId({ ...base, externalEventId: undefined })).toBe(hash);
  });

  it('clamps future timestamps', () => {
    const now = new Date('2026-06-12T12:00:00.000Z');
    const clamped = clampSourceUpdatedAt('2030-01-01T00:00:00.000Z', now);
    expect(clamped.toISOString()).toBe(now.toISOString());
  });

  it('maps Jira webhook payloads to task events', () => {
    const event = mapJiraWebhookToEvent({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      webhookEvent: 'jira:issue_updated',
      issue: {
        id: '10001',
        key: 'ACME-1',
        fields: { updated: '2026-06-12T00:00:00.000Z', status: { statusCategory: { key: 'new' } } },
      },
    });
    expect(event.eventType).toBe('task_updated');
    expect(event.externalEventId).toBe(
      buildTaskExternalEventId({
        source: 'jira',
        eventType: 'task_updated',
        externalId: '10001',
        sourceUpdatedAt: '2026-06-12T00:00:00.000Z',
      }),
    );
  });

  it('aligns Jira webhook and bulk sync dedupe keys for the same issue update', () => {
    const updated = '2026-06-12T00:00:00.000Z';
    const webhookEvent = mapJiraWebhookToEvent({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      webhookEvent: 'jira:issue_updated',
      issue: {
        id: '10001',
        fields: { updated, status: { statusCategory: { key: 'indeterminate' } } },
      },
    });
    const syncEvent = buildTaskUpdatedEvent({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      source: 'jira',
      externalId: '10001',
      sourceUpdatedAt: updated,
    });
    expect(webhookEvent.externalEventId).toBe(syncEvent.externalEventId);
  });
});
