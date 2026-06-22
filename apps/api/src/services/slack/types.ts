export interface SlackCredentials {
  accessToken: string;
  botAccessToken: string;
  teamId: string;
  teamName: string;
  botUserId: string;
  scope: string;
}

export interface SlackChannelRecord {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

export interface SlackUserRecord {
  id: string;
  email?: string | null;
  isBot?: boolean;
}

export interface SlackMessageRecord {
  ts: string;
  user: string;
  text?: string;
  thread_ts?: string;
}
