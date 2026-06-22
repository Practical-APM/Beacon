import type { SalesforceFieldMappings } from '@beacon/shared';
import type { SalesforceCredentials, SalesforceOpportunityRecord } from './types.js';
import { buildOpportunitySoql } from './oauth.js';

const MAX_RETRIES = 3;

export class SalesforceClient {
  constructor(
    private credentials: SalesforceCredentials,
    private readonly onTokenRefreshed?: (credentials: SalesforceCredentials) => Promise<void>,
  ) {}

  get credentialsSnapshot(): SalesforceCredentials {
    return this.credentials;
  }

  async queryOpportunities(params: {
    fieldMappings: SalesforceFieldMappings;
    implementationStages: string[];
    lastSystemModstamp?: string | null;
    limit?: number;
  }): Promise<SalesforceOpportunityRecord[]> {
    const soql = buildOpportunitySoql(
      params.fieldMappings,
      params.implementationStages,
      params.lastSystemModstamp,
      params.limit,
    );
    const data = await this.request<{ records: SalesforceOpportunityRecord[] }>(
      `/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
    );
    return data.records ?? [];
  }

  async describeOpportunityFields(): Promise<Set<string>> {
    const data = await this.request<{ fields: Array<{ name: string }> }>(
      '/services/data/v59.0/sobjects/Opportunity/describe',
    );
    return new Set((data.fields ?? []).map((field) => field.name));
  }

  private async request<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
    const url = path.startsWith('http')
      ? path
      : `${this.credentials.instanceUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (res.status === 401 && attempt < MAX_RETRIES && this.onTokenRefreshed) {
      await this.onTokenRefreshed(this.credentials);
      return this.request(path, init, attempt + 1);
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '2');
      await sleep(retryAfter * 1000 * (attempt + 1));
      return this.request(path, init, attempt + 1);
    }

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Salesforce API error (${res.status}): ${detail}`);
    }

    return (await res.json()) as T;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
