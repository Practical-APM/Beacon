'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ServiceStatus {
  label: string;
  status: 'loading' | 'ok' | 'error';
  detail?: string;
}

async function fetchHealth(path: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, detail: data.status ?? res.statusText };
    }
    return { ok: true, detail: data.status ?? 'ok' };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'Unavailable' };
  }
}

export function StatusPanel() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { label: 'Web', status: 'loading' },
    { label: 'API', status: 'loading' },
    { label: 'API Ready', status: 'loading' },
  ]);

  useEffect(() => {
    async function check() {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

      const [apiHealth, apiReady] = await Promise.all([
        fetchHealth(`${apiBase}/health`),
        fetchHealth(`${apiBase}/ready`),
      ]);

      setServices([
        { label: 'Web', status: 'ok', detail: 'ok' },
        {
          label: 'API /health',
          status: apiHealth.ok ? 'ok' : 'error',
          detail: apiHealth.detail,
        },
        {
          label: 'API /ready',
          status: apiReady.ok ? 'ok' : 'error',
          detail: apiReady.detail,
        },
      ]);
    }

    void check();
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {services.map((service) => (
        <div
          key={service.label}
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{service.label}</span>
            <span
              className={cn(
                'inline-flex h-2.5 w-2.5 rounded-full',
                service.status === 'loading' && 'animate-pulse bg-muted-foreground',
                service.status === 'ok' && 'bg-emerald-500',
                service.status === 'error' && 'bg-destructive',
              )}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{service.detail ?? 'Checking…'}</p>
        </div>
      ))}
    </div>
  );
}
