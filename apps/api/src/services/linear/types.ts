export interface LinearCredentials {
  accessToken: string;
  refreshToken: string;
  organizationId: string;
  organizationName: string;
  issuedAt: string;
  expiresAt?: string | null;
}

export interface LinearTeamRecord {
  id: string;
  key: string;
  name: string;
}

export interface LinearIssueRecord {
  id: string;
  identifier: string;
  title: string;
  state: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  priority: string | null;
  teamId: string;
  updatedAt: string;
}
