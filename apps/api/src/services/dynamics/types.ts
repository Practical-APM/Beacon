export interface DynamicsCredentials {
  accessToken: string;
  refreshToken: string;
  orgUrl: string;
  orgId: string;
  azureTenantId: string;
  issuedAt: string;
  expiresAt?: string | null;
}

export interface DynamicsOpportunityRecord {
  opportunityid: string;
  name: string;
  accountId: string;
  accountName: string;
  ownerName: string;
  ownerEmail: string;
  stageName: string;
  amount: number | null;
  closedate: string | null;
  modifiedon: string;
}
