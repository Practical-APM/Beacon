'use client';

import { ShieldCheck } from 'lucide-react';

export function IntegrationAutoMappingNotice({
  toolName,
  mappedCount,
  pendingCount,
}: {
  toolName: string;
  mappedCount: number;
  pendingCount: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">Automatic project linking</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Beacon links {toolName} to imported CRM projects by name match — no manual mapping
            required. {mappedCount} link{mappedCount === 1 ? '' : 's'} active
            {pendingCount > 0
              ? ` · ${pendingCount} pending match${pendingCount === 1 ? '' : 'es'} will apply after the next CRM import`
              : '.'}
          </p>
        </div>
      </div>
    </div>
  );
}
