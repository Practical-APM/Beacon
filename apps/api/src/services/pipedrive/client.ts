import type { PipedriveFieldMappings, PipedriveIntegrationMetadata } from '@beacon/shared';
import type { PipedriveCredentials, PipedriveDealRecord } from './types.js';

type DealsResponse = {
  data?: Array<{
    id: number;
    title?: string;
    org_id?: { value?: number; name?: string } | number | null;
    org_name?: string | null;
    value?: number | null;
    expected_close_date?: string | null;
    stage_id?: number | null;
    stage_name?: string | null;
    owner_name?: string | null;
    owner_email?: string | null;
    update_time?: string | null;
  }> | null;
};

export class PipedriveClient {
  constructor(
    private credentials: PipedriveCredentials,
    private readonly onTokenRefreshed?: (credentials: PipedriveCredentials) => Promise<void>,
  ) {}

  async listDeals(params: {
    fieldMappings: PipedriveFieldMappings;
    implementationStages: string[];
    lastModifiedAt?: string | null;
    limit?: number;
  }): Promise<PipedriveDealRecord[]> {
    const baseUrl = this.credentials.apiDomain.startsWith('http')
      ? this.credentials.apiDomain
      : `https://${this.credentials.apiDomain}`;
    const records: PipedriveDealRecord[] = [];
    let start = 0;
    const pageSize = 100;

    while (records.length < (params.limit ?? 200)) {
      const url = new URL(`${baseUrl}/api/v1/deals`);
      url.searchParams.set('status', 'open');
      url.searchParams.set('start', String(start));
      url.searchParams.set('limit', String(pageSize));

      const page = await this.request<DealsResponse>(url.toString());
      const rows = page.data ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const stageName = row.stage_name ?? '';
        if (
          !params.implementationStages.some(
            (stage) => stageName.toLowerCase() === stage.toLowerCase(),
          )
        ) {
          continue;
        }

        const updateTime = row.update_time ?? new Date().toISOString();
        if (params.lastModifiedAt && updateTime <= params.lastModifiedAt) {
          continue;
        }

        const orgId =
          typeof row.org_id === 'object' && row.org_id
            ? String(row.org_id.value ?? row.id)
            : String(row.org_id ?? `unknown-${row.id}`);

        records.push({
          id: String(row.id),
          title: row.title ?? 'Untitled Deal',
          org_id: orgId,
          org_name: row.org_name ?? 'Unknown Organization',
          owner_name: row.owner_name ?? '',
          owner_email: row.owner_email ?? '',
          stage_name: stageName,
          value: typeof row.value === 'number' ? row.value : null,
          expected_close_date: row.expected_close_date ?? null,
          update_time: updateTime,
        });

        if (params.limit && records.length >= params.limit) {
          return records;
        }
      }

      if (rows.length < pageSize) break;
      start += pageSize;
    }

    return records;
  }

  async describeDealFields(): Promise<Set<string>> {
    const baseUrl = this.credentials.apiDomain.startsWith('http')
      ? this.credentials.apiDomain
      : `https://${this.credentials.apiDomain}`;
    const data = await this.request<{ data?: Array<{ key?: string }> }>(
      `${baseUrl}/api/v1/dealFields`,
    );
    return new Set((data.data ?? []).map((field) => field.key).filter(Boolean) as string[]);
  }

  private async request<T>(url: string, init?: RequestInit, attempt = 0): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (res.status === 401 && attempt < 2 && this.onTokenRefreshed) {
      await this.onTokenRefreshed(this.credentials);
      return this.request(url, init, attempt + 1);
    }

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Pipedrive API error (${res.status}): ${detail}`);
    }

    return (await res.json()) as T;
  }
}

export async function fetchLiveDeals(
  credentials: PipedriveCredentials,
  metadata: PipedriveIntegrationMetadata,
  jobType: 'bulk' | 'incremental',
  onTokenRefreshed?: (credentials: PipedriveCredentials) => Promise<void>,
): Promise<PipedriveDealRecord[]> {
  const client = new PipedriveClient(credentials, onTokenRefreshed);
  return client.listDeals({
    fieldMappings: metadata.fieldMappings,
    implementationStages: metadata.implementationStages,
    lastModifiedAt: jobType === 'incremental' ? metadata.lastModifiedAt : null,
    limit: 200,
  });
}
