import type { HubSpotFieldMappings, HubSpotIntegrationMetadata } from '@beacon/shared';
import type { HubSpotCredentials, HubSpotDealRecord } from './types.js';

const MAX_RETRIES = 3;
const HUBSPOT_API = 'https://api.hubapi.com';

type DealSearchResult = {
  results: Array<{
    id: string;
    properties: Record<string, string | null | undefined>;
  }>;
  paging?: { next?: { after?: string } };
};

type AssociationBatchResult = {
  results: Array<{
    from: { id: string };
    to: Array<{ toObjectId: string }>;
  }>;
};

type CompanyBatchResult = {
  results: Array<{
    id: string;
    properties: Record<string, string | null | undefined>;
  }>;
};

type OwnerRecord = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

export class HubSpotClient {
  constructor(
    private credentials: HubSpotCredentials,
    private readonly onTokenRefreshed?: (credentials: HubSpotCredentials) => Promise<void>,
  ) {}

  async searchDeals(params: {
    fieldMappings: HubSpotFieldMappings;
    implementationStages: string[];
    lastModifiedAt?: string | null;
    limit?: number;
  }): Promise<HubSpotDealRecord[]> {
    const properties = collectDealProperties(params.fieldMappings);
    const deals: DealSearchResult['results'] = [];
    let after: string | undefined;

    do {
      const body: Record<string, unknown> = {
        properties,
        limit: Math.min(params.limit ?? 100, 100),
        filterGroups: [
          {
            filters: [
              {
                propertyName: params.fieldMappings.stageName,
                operator: 'IN',
                values: params.implementationStages,
              },
            ],
          },
        ],
        sorts: [{ propertyName: params.fieldMappings.lastModified, direction: 'ASCENDING' }],
      };

      if (params.lastModifiedAt) {
        (body.filterGroups as Array<{ filters: unknown[] }>)[0]!.filters.push({
          propertyName: params.fieldMappings.lastModified,
          operator: 'GT',
          value: params.lastModifiedAt,
        });
      }

      if (after) {
        body.after = after;
      }

      const page = await this.request<DealSearchResult>('/crm/v3/objects/deals/search', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      deals.push(...(page.results ?? []));
      after = page.paging?.next?.after;
      if (params.limit && deals.length >= params.limit) break;
    } while (after);

    const companyByDeal = await this.loadPrimaryCompanies(deals.map((deal) => deal.id));
    const owners = await this.loadOwners(deals, params.fieldMappings);

    return deals.map((deal) => {
      const props = deal.properties ?? {};
      const company = companyByDeal.get(deal.id);
      const ownerId = props[params.fieldMappings.ownerName] ?? props.hubspot_owner_id ?? '';
      const owner = owners.get(String(ownerId));

      return {
        id: deal.id,
        dealname: props[params.fieldMappings.dealName] ?? 'Untitled Deal',
        companyId: company?.id ?? `unknown-${deal.id}`,
        companyName: company?.name ?? 'Unknown Company',
        ownerName: owner?.name ?? '',
        ownerEmail: owner?.email ?? '',
        dealstage: props[params.fieldMappings.stageName] ?? '',
        amount: parseAmount(props[params.fieldMappings.arrAmount]),
        closedate: props[params.fieldMappings.goLiveDate] ?? null,
        hs_lastmodifieddate:
          props[params.fieldMappings.lastModified] ?? new Date().toISOString(),
      };
    });
  }

  async describeDealProperties(): Promise<Set<string>> {
    type PropertyResult = { results?: Array<{ name: string }> };
    const data = await this.request<PropertyResult>('/crm/v3/properties/deals');
    const names = new Set((data.results ?? []).map((property) => property.name));
    names.add('hubspot_owner_id');
    return names;
  }

  private async loadPrimaryCompanies(dealIds: string[]) {
    const map = new Map<string, { id: string; name: string }>();
    if (dealIds.length === 0) return map;

    const association = await this.request<AssociationBatchResult>(
      '/crm/v4/associations/deals/companies/batch/read',
      {
        method: 'POST',
        body: JSON.stringify({
          inputs: dealIds.map((id) => ({ id })),
        }),
      },
    );

    const companyIds = new Set<string>();
    const dealToCompany = new Map<string, string>();
    for (const row of association.results ?? []) {
      const companyId = row.to[0]?.toObjectId;
      if (!companyId) continue;
      dealToCompany.set(row.from.id, companyId);
      companyIds.add(companyId);
    }

    if (companyIds.size === 0) return map;

    const companies = await this.request<CompanyBatchResult>('/crm/v3/objects/companies/batch/read', {
      method: 'POST',
      body: JSON.stringify({
        properties: ['name'],
        inputs: [...companyIds].map((id) => ({ id })),
      }),
    });

    const companyNames = new Map<string, string>();
    for (const company of companies.results ?? []) {
      companyNames.set(company.id, company.properties?.name ?? 'Unknown Company');
    }

    for (const [dealId, companyId] of dealToCompany) {
      map.set(dealId, {
        id: companyId,
        name: companyNames.get(companyId) ?? 'Unknown Company',
      });
    }

    return map;
  }

  private async loadOwners(
    deals: DealSearchResult['results'],
    mappings: HubSpotFieldMappings,
  ) {
    const map = new Map<string, { name: string; email: string }>();
    const ownerIds = new Set<string>();

    for (const deal of deals) {
      const ownerId = deal.properties?.[mappings.ownerName] ?? deal.properties?.hubspot_owner_id;
      if (ownerId) ownerIds.add(String(ownerId));
    }

    await Promise.all(
      [...ownerIds].map(async (ownerId) => {
        try {
          const owner = await this.request<OwnerRecord>(`/crm/v3/owners/${ownerId}`);
          const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
          map.set(ownerId, {
            name: name || owner.email || 'Owner',
            email: owner.email ?? '',
          });
        } catch {
          map.set(ownerId, { name: 'Owner', email: '' });
        }
      }),
    );

    return map;
  }

  private async request<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
    const url = path.startsWith('http') ? path : `${HUBSPOT_API}${path.startsWith('/') ? path : `/${path}`}`;

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
      throw new Error(`HubSpot API error (${res.status}): ${detail}`);
    }

    return (await res.json()) as T;
  }
}

function collectDealProperties(mappings: HubSpotFieldMappings): string[] {
  return [
    ...new Set([
      mappings.dealName,
      mappings.arrAmount,
      mappings.goLiveDate,
      mappings.stageName,
      mappings.lastModified,
      'hubspot_owner_id',
    ]),
  ];
}

function parseAmount(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchLiveDeals(
  credentials: HubSpotCredentials,
  metadata: HubSpotIntegrationMetadata,
  jobType: 'bulk' | 'incremental',
  onTokenRefreshed?: (credentials: HubSpotCredentials) => Promise<void>,
): Promise<HubSpotDealRecord[]> {
  const client = new HubSpotClient(credentials, onTokenRefreshed);
  return client.searchDeals({
    fieldMappings: metadata.fieldMappings,
    implementationStages: metadata.implementationStages,
    lastModifiedAt: jobType === 'incremental' ? metadata.lastModifiedAt : null,
    limit: 200,
  });
}
