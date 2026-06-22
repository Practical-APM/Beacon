'use client';

import { useAppSession } from '@/components/providers/app-session-provider';
import { useCallback } from 'react';

export function useApiClient() {
  const { me, activeTenantId, getAuthHeaders } = useAppSession();

  const apiFetch = useCallback(
    async <T = unknown>(path: string, init?: RequestInit): Promise<T> => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const externalAuthId = me?.user.externalAuthId;
      if (!externalAuthId || !activeTenantId) {
        throw new Error('Missing session');
      }

      const authHeaders = await getAuthHeaders(activeTenantId);
      const headers: Record<string, string> = {
        ...authHeaders,
        ...(init?.headers as Record<string, string> | undefined),
      };

      const res = await fetch(`${apiUrl}${path}`, { ...init, headers, cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          detail?: string;
          title?: string;
        } | null;
        throw new Error(body?.detail ?? body?.title ?? `Request failed (${res.status})`);
      }
      if (res.status === 204) return null as T;
      return res.json() as Promise<T>;
    },
    [activeTenantId, getAuthHeaders, me?.user.externalAuthId],
  );

  return { apiFetch, ready: Boolean(me?.user.externalAuthId && activeTenantId) };
}
