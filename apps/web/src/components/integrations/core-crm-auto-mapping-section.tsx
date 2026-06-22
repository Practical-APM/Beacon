'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ShieldCheck, Wrench } from 'lucide-react';
import { CATALOG_CONNECT_PATHS, type IntegrationCatalogId } from '@beacon/shared/integrations';

type MappingRails = {
  status: 'healthy' | 'repaired' | 'degraded';
  lastCheckedAt: string | null;
  autoConfigured: boolean;
  repairs: Array<{
    logicalField: string;
    previousSourceField: string;
    resolvedSourceField: string;
    repairedAt: string;
  }>;
  issues: string[];
};

type CoreCrmStatus = {
  connected: boolean;
  metadata?: {
    mappingComplete?: boolean;
    fieldMappings?: Record<string, string>;
    mappingRails?: MappingRails;
  } | null;
};

const STATUS_COPY: Record<MappingRails['status'], { label: string; className: string }> = {
  healthy: {
    label: 'Auto-configured',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  repaired: {
    label: 'Auto-repaired',
    className: 'bg-primary/10 text-primary',
  },
  degraded: {
    label: 'Needs attention',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
};

const SETUP_COPY: Record<string, string> = {
  salesforce:
    'Standard Opportunity fields (Name, Amount, CloseDate, Owner, Stage) are mapped on connect — no manual configuration.',
  hubspot:
    'Standard deal properties (dealname, amount, closedate, dealstage, owner) are mapped on connect — no manual configuration.',
  microsoft_dynamics:
    'Standard opportunity fields (name, value, close date, stage, owner) are mapped on connect — no manual configuration.',
  pipedrive:
    'Standard deal fields (title, value, expected close date, stage, owner) are mapped on connect — no manual configuration.',
};

export function CoreCrmAutoMappingSection({
  apiFetch,
  coreCrmId,
  coreCrmName,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<unknown>;
  coreCrmId: string;
  coreCrmName: string;
}) {
  const [status, setStatus] = useState<CoreCrmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const connectPath = CATALOG_CONNECT_PATHS[coreCrmId as IntegrationCatalogId];

  const refresh = useCallback(async () => {
    if (!connectPath) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = (await apiFetch(`/v1/integrations/${connectPath}/status`)) as CoreCrmStatus;
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, connectPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!connectPath || !status?.connected) return null;

  const rails = status.metadata?.mappingRails;
  const railsStatus = rails?.status ?? (status.metadata?.mappingComplete ? 'healthy' : 'degraded');
  const badge = STATUS_COPY[railsStatus];
  const setupDetail =
    SETUP_COPY[coreCrmId] ??
    'Required CRM fields are mapped on connect — no manual configuration.';

  return (
    <div id={`${coreCrmId}-mappings`} className="mt-6 scroll-mt-24 border-t border-border pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="settings-section-title">{coreCrmName} data mapping</h2>
          <p className="settings-section-lead">
            Beacon configures and monitors field mappings automatically. If your {coreCrmName} schema
            changes, mappings are repaired in the background so your work is not interrupted.
          </p>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading mapping status…</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Automatic setup
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{setupDetail}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wrench className="h-4 w-4 text-primary" aria-hidden />
              Schema monitoring
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Checked before each sync
              {rails?.lastCheckedAt
                ? ` · Last check ${new Date(rails.lastCheckedAt).toLocaleString()}`
                : ''}
              .
            </p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Check className="h-4 w-4 text-emerald-600" aria-hidden />
              Sync readiness
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {status.metadata?.mappingComplete
                ? 'Ready — bulk sync runs without manual steps.'
                : 'Mappings are being auto-configured.'}
            </p>
          </div>
        </div>
      )}

      {rails?.repairs.length ? (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">Recent auto-repairs</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {rails.repairs.slice(-3).map((repair) => (
              <li key={`${repair.logicalField}-${repair.repairedAt}`}>
                {repair.logicalField}: {repair.previousSourceField} → {repair.resolvedSourceField}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rails?.issues.length ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-medium">Mapping attention needed</p>
          <ul className="mt-2 list-disc pl-5">
            {rails.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
