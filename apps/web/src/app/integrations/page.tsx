'use client';

import { AppShell } from '@/components/app-shell';
import { RequireAuth } from '@/components/require-auth';
import { Suspense } from 'react';
import { IntegrationsContent } from './integrations-content';

export default function IntegrationsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading integrations…</p>}>
          <IntegrationsContent />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
