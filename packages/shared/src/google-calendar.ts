import { extractEmailDomain, isCustomerParticipant, isInternalParticipant } from './slack.js';

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
] as const;

export interface GoogleCalendarIntegrationMetadata {
  accountEmail: string;
  accountName: string;
  internalDomains: string[];
  customerDomains: string[];
  lastSyncAt?: string | null;
  syncProgress?: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    recordsProcessed: number;
    recordsTotal: number | null;
    startedAt?: string;
    completedAt?: string;
    error?: string | null;
  };
}

export interface CalendarSummary {
  id: string;
  name: string;
  primary?: boolean;
}

export interface CalendarMeetingSample {
  id: string;
  summary: string;
  startAt: string;
  endAt: string;
  attendeeEmails: string[];
}

export interface CalendarProjectSignals {
  calendarId: string;
  calendarName: string;
  lastMeetingAt: string | null;
  lastCustomerMeetingAt: string | null;
  meetingCount30d: number;
  stale: boolean;
}

export interface CalendarSignalComputationInput {
  meetings: CalendarMeetingSample[];
  internalDomains: string[];
  customerDomains: string[];
  domainOverrides?: string[];
}

export function computeCalendarProjectSignals(
  input: CalendarSignalComputationInput,
): CalendarProjectSignals {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sorted = [...input.meetings].sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );

  let lastMeetingAt: string | null = null;
  let lastCustomerMeetingAt: string | null = null;
  let meetingCount30d = 0;

  for (const meeting of sorted) {
    const startMs = new Date(meeting.startAt).getTime();
    if (!lastMeetingAt) lastMeetingAt = meeting.startAt;
    if (startMs >= thirtyDaysAgo) meetingCount30d += 1;

    const hasCustomer = meeting.attendeeEmails.some((email) =>
      isCustomerParticipant(
        email,
        input.customerDomains,
        input.internalDomains,
        input.domainOverrides ?? [],
      ),
    );
    if (hasCustomer && !lastCustomerMeetingAt) {
      lastCustomerMeetingAt = meeting.startAt;
    }
  }

  return {
    calendarId: '',
    calendarName: '',
    lastMeetingAt,
    lastCustomerMeetingAt,
    meetingCount30d,
    stale: false,
  };
}

export function customerWaitingDaysFromCalendarSignals(
  signals: Pick<CalendarProjectSignals, 'lastCustomerMeetingAt'>,
  timezone: string,
  businessDaysBetween: (start: Date, end: Date, timezone: string) => number,
): number | null {
  if (!signals.lastCustomerMeetingAt) return null;
  const last = new Date(signals.lastCustomerMeetingAt);
  if (Number.isNaN(last.getTime())) return null;
  return businessDaysBetween(last, new Date(), timezone);
}

export function suggestCalendarMappings(
  calendars: CalendarSummary[],
  projects: Array<{ id: string; name: string }>,
): Array<{
  calendarId: string;
  calendarName: string;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  confidence: number;
}> {
  return calendars.map((calendar) => {
    const normalizedCalendar = calendar.name.toLowerCase();
    let best: { id: string; name: string; confidence: number } | null = null;

    for (const project of projects) {
      const tokens = project.name.toLowerCase().split(/\s+/).filter((token) => token.length > 3);
      const matches = tokens.filter((token) => normalizedCalendar.includes(token)).length;
      if (matches === 0) continue;
      const confidence = Math.min(0.95, matches / Math.max(tokens.length, 1));
      if (!best || confidence > best.confidence) {
        best = { id: project.id, name: project.name, confidence };
      }
    }

    return {
      calendarId: calendar.id,
      calendarName: calendar.name,
      suggestedProjectId: best?.id ?? null,
      suggestedProjectName: best?.name ?? null,
      confidence: best?.confidence ?? 0,
    };
  });
}

export { extractEmailDomain, isCustomerParticipant, isInternalParticipant };
