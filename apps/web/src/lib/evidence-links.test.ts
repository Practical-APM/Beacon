import { describe, expect, it } from 'vitest';
import { formatTimelineEvent, resolveEvidenceLink } from './evidence-links';

describe('evidence-links', () => {
  it('marks missing links as unavailable', () => {
    expect(resolveEvidenceLink({ source: 'jira', description: 'Blocked task' }).unavailable).toBe(
      true,
    );
  });

  it('uses explicit deep links', () => {
    expect(
      resolveEvidenceLink({
        source: 'jira',
        deepLink: 'https://jira.example.com/browse/ABC-1',
      }).href,
    ).toBe('https://jira.example.com/browse/ABC-1');
  });

  it('formats go-live date timeline events', () => {
    expect(
      formatTimelineEvent({
        eventType: 'customer_updated',
        source: 'salesforce',
        payload: { field: 'goLiveDate' },
      }),
    ).toContain('Go-live date updated');
  });
});
