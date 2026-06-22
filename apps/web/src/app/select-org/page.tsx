'use client';

import { AppShell } from '@/components/app-shell';
import { AppPageHeader } from '@/components/app-page-header';
import { ContextualDocsLink } from '@/components/contextual-docs-link';
import { RequireAuth } from '@/components/require-auth';
import { useAppSession } from '@/components/providers/app-session-provider';
import { cn } from '@/lib/utils';
import { Building2, Check } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ROLE_HINTS: Record<string, string> = {
  admin: 'Connect integrations, manage settings, and acknowledge risks.',
  contributor: 'View portfolio and project risks. Cannot change integrations or risk status.',
  operational: 'Acknowledge and resolve risks. Cannot manage org settings.',
};

export default function SelectOrgPage() {
  const router = useRouter();
  const { activeTenantId, me, setActiveTenantId } = useAppSession();

  useEffect(() => {
    if (activeTenantId) {
      router.replace('/dashboard');
    }
  }, [activeTenantId, router]);

  if (!me) return null;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto max-w-lg space-y-6">
          <AppPageHeader
            title="Choose an organization"
            description="Your account belongs to multiple organizations. Pick one to continue into your workspace."
          >
            <ContextualDocsLink />
          </AppPageHeader>

          <section className="settings-section">
            <p className="text-sm text-muted-foreground">Signed in as {me.user.email}</p>

            <ul className="mt-4 space-y-2">
              {me.memberships.map((membership) => {
                const selected = activeTenantId === membership.tenantId;
                return (
                  <li key={membership.tenantId}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                        selected
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border hover:bg-accent/40',
                      )}
                      onClick={() => void setActiveTenantId(membership.tenantId)}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Building2 className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">
                          {membership.tenantName}
                        </span>
                        <span className="mt-0.5 block text-sm capitalize text-muted-foreground">
                          {membership.role}
                          {ROLE_HINTS[membership.role] ? (
                            <span className="mt-1 block text-xs normal-case leading-snug">
                              {ROLE_HINTS[membership.role]}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      {selected ? (
                        <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
