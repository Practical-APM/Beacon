export interface HubSpotCredentials {
  accessToken: string;
  refreshToken: string;
  portalId: string;
  issuedAt: string;
  expiresAt?: string | null;
}

export interface HubSpotDealRecord {
  id: string;
  dealname: string;
  companyId: string;
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  dealstage: string;
  amount: number | null;
  closedate: string | null;
  hs_lastmodifieddate: string;
}

export interface MappedHubSpotRecord {
  dealId: string;
  dealName: string;
  companyId: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  stageName: string | null;
  arrAmount: number | null;
  arrCurrency: string;
  goLiveDate: Date | null;
  dataComplete: boolean;
  lastModified: string | null;
}
