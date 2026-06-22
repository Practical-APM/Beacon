export interface PipedriveCredentials {
  accessToken: string;
  refreshToken: string;
  companyId: string;
  apiDomain: string;
  issuedAt: string;
  expiresAt?: string | null;
}

export interface PipedriveDealRecord {
  id: string;
  title: string;
  org_id: string;
  org_name: string;
  owner_name: string;
  owner_email: string;
  stage_name: string;
  value: number | null;
  expected_close_date: string | null;
  update_time: string;
}
