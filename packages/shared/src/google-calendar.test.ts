import { computeCalendarProjectSignals } from './google-calendar.js';
import { describe, expect, it } from 'vitest';

describe('google calendar helpers', () => {
  it('computes meeting signals from attendee domains', () => {
    const signals = computeCalendarProjectSignals({
      internalDomains: ['acme-demo.test'],
      customerDomains: ['customer.com'],
      meetings: [
        {
          id: '1',
          summary: 'Sync',
          startAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          endAt: new Date().toISOString(),
          attendeeEmails: ['admin@acme-demo.test', 'buyer@customer.com'],
        },
        {
          id: '2',
          summary: 'Old meeting',
          startAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
          endAt: new Date().toISOString(),
          attendeeEmails: ['admin@acme-demo.test', 'buyer@customer.com'],
        },
      ],
    });

    expect(signals.lastCustomerMeetingAt).toBeTruthy();
    expect(signals.meetingCount30d).toBe(1);
  });
});
