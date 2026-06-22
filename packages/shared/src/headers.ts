import { REQUEST_ID_HEADER, TENANT_ID_HEADER } from './constants.js';

export function getOrCreateRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER);
  if (existing) return existing;
  return crypto.randomUUID();
}

export function getTenantId(headers: Headers): string | null {
  return headers.get(TENANT_ID_HEADER);
}

export function withRequestHeaders(
  requestId: string,
  tenantId?: string | null,
): Record<string, string> {
  const result: Record<string, string> = {
    [REQUEST_ID_HEADER]: requestId,
  };
  if (tenantId) {
    result[TENANT_ID_HEADER] = tenantId;
  }
  return result;
}
