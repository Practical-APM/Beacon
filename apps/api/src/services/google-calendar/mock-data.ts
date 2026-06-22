import type { CalendarMeetingSample } from '@beacon/shared/google-calendar';
import type { CalendarMeetingRecord, CalendarRecord, GoogleCalendarCredentials } from './types.js';

export function createMockGoogleCalendarCredentials(): GoogleCalendarCredentials {
  return {
    accessToken: 'mock-google-access-token',
    refreshToken: 'mock-google-refresh-token',
    accountEmail: 'admin-a@acme-demo.test',
    accountName: 'Acme Admin',
    scope: 'calendar.readonly',
  };
}

export const DEFAULT_MOCK_CALENDAR_MAPPINGS = [
  { calendarId: 'primary', calendarName: 'Acme Implementation Calendar' },
  { calendarId: 'customer-implementation', calendarName: 'Customer Implementation Sync' },
];

export function getMockCalendars(): CalendarRecord[] {
  return [
    { id: 'primary', name: 'Acme Implementation Calendar', primary: true },
    { id: 'customer-implementation', name: 'Customer Implementation Sync' },
    { id: 'internal-standup', name: 'Internal Standup' },
  ];
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function getMockCalendarMeetings(calendarId: string): CalendarMeetingRecord[] {
  if (calendarId === 'primary') {
    return [
      {
        id: 'evt-1',
        summary: 'Weekly implementation sync',
        startAt: daysAgoIso(3),
        endAt: daysAgoIso(3),
        attendeeEmails: ['admin-a@acme-demo.test', 'buyer@customer.com'],
      },
      {
        id: 'evt-2',
        summary: 'Security review checkpoint',
        startAt: daysAgoIso(18),
        endAt: daysAgoIso(18),
        attendeeEmails: ['contributor-a@acme-demo.test', 'buyer@customer.com'],
      },
    ];
  }

  if (calendarId === 'customer-implementation') {
    return [
      {
        id: 'evt-3',
        summary: 'Customer steering committee',
        startAt: daysAgoIso(21),
        endAt: daysAgoIso(21),
        attendeeEmails: ['admin-a@acme-demo.test', 'steering@customer.com'],
      },
    ];
  }

  return [
    {
      id: 'evt-internal',
      summary: 'Internal standup',
      startAt: daysAgoIso(1),
      endAt: daysAgoIso(1),
      attendeeEmails: ['contributor-a@acme-demo.test', 'admin-a@acme-demo.test'],
    },
  ];
}

export function toMeetingSamples(records: CalendarMeetingRecord[]): CalendarMeetingSample[] {
  return records.map((record) => ({
    id: record.id,
    summary: record.summary,
    startAt: record.startAt,
    endAt: record.endAt,
    attendeeEmails: record.attendeeEmails,
  }));
}
