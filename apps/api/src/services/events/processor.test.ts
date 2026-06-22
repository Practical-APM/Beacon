import { describe, expect, it } from 'vitest';
import {
  buildIntegrationHealthEvent,
  resolveExternalEventId,
  validateCanonicalEvent,
} from '@beacon/shared/events';

describe('event processor helpers', () => {
  it('resolves stable external event ids', () => {
    const first = validateCanonicalEvent({
      eventType: 'task_updated',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      source: 'jira',
      externalEventId: 'jira:1',
      sourceUpdatedAt: '2026-06-12T00:00:00.000Z',
    });
    const second = { ...first, externalEventId: 'jira:1' };
    expect(resolveExternalEventId(first)).toBe(resolveExternalEventId(second));
  });

  it('builds integration health events', () => {
    const event = buildIntegrationHealthEvent({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      source: 'salesforce',
      status: 'connected',
      recordsProcessed: 12,
    });
    expect(event.eventType).toBe('integration_health');
    expect(event.source).toBe('salesforce');
  });
});
