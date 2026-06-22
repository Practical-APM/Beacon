import type { DynamicsFieldMappings, DynamicsIntegrationMetadata } from '@beacon/shared';
import type { DynamicsCredentials, DynamicsOpportunityRecord } from './types.js';

const MAX_RETRIES = 3;

type OpportunityEntity = {
  opportunityid: string;
  name?: string;
  estimatedvalue?: number | null;
  estimatedclosedate?: string | null;
  modifiedon?: string;
  statuscodename?: string;
  customerid_account?: { accountid?: string; name?: string | null } | null;
  owninguser?: { fullname?: string | null; internalemailaddress?: string | null } | null;
};

type QueryResponse = {
  value: OpportunityEntity[];
  '@odata.nextLink'?: string;
};

export class DynamicsClient {
  constructor(
    private credentials: DynamicsCredentials,
    private readonly onTokenRefreshed?: (credentials: DynamicsCredentials) => Promise<void>,
  ) {}

  async queryOpportunities(params: {
    fieldMappings: DynamicsFieldMappings;
    implementationStages: string[];
    lastModifiedAt?: string | null;
    limit?: number;
  }): Promise<DynamicsOpportunityRecord[]> {
    const records: DynamicsOpportunityRecord[] = [];
    let url = this.buildQuery(params);

    while (url) {
      const page = await this.request<QueryResponse>(url);
      for (const row of page.value ?? []) {
        const stageName = row.statuscodename ?? '';
        if (!params.implementationStages.some((stage) => stageName.toLowerCase().includes(stage.toLowerCase()))) {
          continue;
        }
        if (params.lastModifiedAt && row.modifiedon && row.modifiedon <= params.lastModifiedAt) {
          continue;
        }

        records.push({
          opportunityid: row.opportunityid,
          name: row.name ?? 'Untitled Opportunity',
          accountId: row.customerid_account?.accountid ?? `unknown-${row.opportunityid}`,
          accountName: row.customerid_account?.name ?? 'Unknown Account',
          ownerName: row.owninguser?.fullname ?? '',
          ownerEmail: row.owninguser?.internalemailaddress ?? '',
          stageName,
          amount: typeof row.estimatedvalue === 'number' ? row.estimatedvalue : null,
          closedate: row.estimatedclosedate ?? null,
          modifiedon: row.modifiedon ?? new Date().toISOString(),
        });

        if (params.limit && records.length >= params.limit) {
          return records;
        }
      }

      url = page['@odata.nextLink'] ?? '';
    }

    return records;
  }

  async describeOpportunityAttributes(): Promise<Set<string>> {
    type AttributeResult = { value?: Array<{ LogicalName?: string }> };
    const data = await this.request<AttributeResult>(
      "/api/data/v9.2/EntityDefinitions(LogicalName='opportunity')/Attributes?$select=LogicalName",
    );
    const names = new Set(
      (data.value ?? [])
        .map((attribute) => attribute.LogicalName)
        .filter((name): name is string => Boolean(name)),
    );
    for (const field of ['accountId', 'accountName', 'ownerName', 'ownerEmail', 'amount', 'closedate', 'stageName']) {
      names.add(field);
    }
    return names;
  }

  private buildQuery(params: {
    implementationStages: string[];
    lastModifiedAt?: string | null;
    limit?: number;
  }) {
    const filters = ['statecode eq 0'];
    if (params.lastModifiedAt) {
      filters.push(`modifiedon gt ${params.lastModifiedAt}`);
    }

    const select = [
      'opportunityid',
      'name',
      'estimatedvalue',
      'estimatedclosedate',
      'modifiedon',
      'statuscodename',
    ].join(',');

    const expand =
      'customerid_account($select=accountid,name),owninguser($select=fullname,internalemailaddress)';

    const query = new URLSearchParams({
      $select: select,
      $expand: expand,
      $filter: filters.join(' and '),
      $orderby: 'modifiedon asc',
      $top: String(Math.min(params.limit ?? 100, 100)),
    });

    return `${this.credentials.orgUrl}/api/data/v9.2/opportunities?${query.toString()}`;
  }

  private async request<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
    const url = path.startsWith('http')
      ? path
      : `${this.credentials.orgUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        ...(init?.headers ?? {}),
      },
    });

    if (res.status === 401 && attempt < MAX_RETRIES && this.onTokenRefreshed) {
      await this.onTokenRefreshed(this.credentials);
      return this.request(path, init, attempt + 1);
    }

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Dynamics API error (${res.status}): ${detail}`);
    }

    return (await res.json()) as T;
  }
}

export async function fetchLiveOpportunities(
  credentials: DynamicsCredentials,
  metadata: DynamicsIntegrationMetadata,
  jobType: 'bulk' | 'incremental',
  onTokenRefreshed?: (credentials: DynamicsCredentials) => Promise<void>,
): Promise<DynamicsOpportunityRecord[]> {
  const client = new DynamicsClient(credentials, onTokenRefreshed);
  return client.queryOpportunities({
    fieldMappings: metadata.fieldMappings,
    implementationStages: metadata.implementationStages,
    lastModifiedAt: jobType === 'incremental' ? metadata.lastModifiedAt : null,
    limit: 200,
  });
}
