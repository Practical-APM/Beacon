export interface GoogleCalendarCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  accountEmail: string;
  accountName: string;
  scope: string;
}

export interface CalendarRecord {
  id: string;
  name: string;
  primary?: boolean;
}

export interface CalendarMeetingRecord {
  id: string;
  summary: string;
  startAt: string;
  endAt: string;
  attendeeEmails: string[];
}
