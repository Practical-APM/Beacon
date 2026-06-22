import type { SalesforceEnvironment } from '@beacon/shared';

export interface SalesforceCredentials {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  environment: SalesforceEnvironment;
  orgId: string;
  issuedAt: string;
}

export interface SalesforceOpportunityRecord {
  Id: string;
  Name: string;
  AccountId: string;
  Account?: { Name?: string | null } | null;
  Owner?: { Name?: string | null; Email?: string | null } | null;
  StageName?: string | null;
  IsClosed?: boolean | null;
  IsWon?: boolean | null;
  Amount?: number | null;
  CloseDate?: string | null;
  CurrencyIsoCode?: string | null;
  SystemModstamp?: string | null;
}

export interface MappedSalesforceRecord {
  opportunityId: string;
  opportunityName: string;
  accountId: string;
  accountName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  stageName: string | null;
  arrAmount: number | null;
  arrCurrency: string;
  goLiveDate: Date | null;
  dataComplete: boolean;
  systemModstamp: string | null;
}
