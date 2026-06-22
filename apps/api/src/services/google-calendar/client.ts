import { env } from '../../env.js';
import { getMockCalendarMeetings, getMockCalendars } from './mock-data.js';
import type { CalendarMeetingRecord, CalendarRecord, GoogleCalendarCredentials } from './types.js';

export function createGoogleCalendarClient(credentials: GoogleCalendarCredentials) {
  const isMock = credentials.accessToken.includes('mock');

  return {
    async listCalendars(): Promise<CalendarRecord[]> {
      if (isMock || !env.GOOGLE_CALENDAR_ENABLED) {
        return getMockCalendars();
      }
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to list Google calendars');
      const payload = (await response.json()) as {
        items?: Array<{ id?: string; summary?: string; primary?: boolean }>;
      };
      return (payload.items ?? []).map((item) => ({
        id: item.id ?? 'unknown',
        name: item.summary ?? item.id ?? 'Calendar',
        primary: item.primary,
      }));
    },

    async listMeetings(calendarId: string, since: Date): Promise<CalendarMeetingRecord[]> {
      if (isMock || !env.GOOGLE_CALENDAR_ENABLED) {
        return getMockCalendarMeetings(calendarId).filter(
          (meeting) => new Date(meeting.startAt).getTime() >= since.getTime(),
        );
      }

      const search = new URLSearchParams({
        timeMin: since.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '100',
      });
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${search}`,
        { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
      );
      if (!response.ok) throw new Error(`Failed to list events for calendar ${calendarId}`);
      const payload = (await response.json()) as {
        items?: Array<{
          id?: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          attendees?: Array<{ email?: string }>;
        }>;
      };

      return (payload.items ?? []).map((item) => ({
        id: item.id ?? 'unknown',
        summary: item.summary ?? 'Meeting',
        startAt: item.start?.dateTime ?? item.start?.date ?? new Date().toISOString(),
        endAt: item.end?.dateTime ?? item.end?.date ?? new Date().toISOString(),
        attendeeEmails: (item.attendees ?? [])
          .map((attendee) => attendee.email)
          .filter((email): email is string => Boolean(email)),
      }));
    },
  };
}
