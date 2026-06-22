'use client';

import { cn } from '@/lib/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export type SettingsTabId = 'preferences' | 'account' | 'notifications' | 'privacy' | 'admin';

const BASE_TABS: Array<{ id: SettingsTabId; label: string; description: string }> = [
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Language, currency, and appearance',
  },
  { id: 'account', label: 'Account', description: 'Profile, organization, and legal' },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email and in-app alerts',
  },
  { id: 'privacy', label: 'Privacy', description: 'Export, deletion, and DPA' },
];

export function SettingsTabs({
  showAdmin,
  activeTab,
}: {
  showAdmin: boolean;
  activeTab: SettingsTabId;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = useMemo(
    () =>
      showAdmin
        ? [
            ...BASE_TABS,
            {
              id: 'admin' as const,
              label: 'Admin',
              description: 'Rules, webhooks, and compliance',
            },
          ]
        : BASE_TABS,
    [showAdmin],
  );

  const setTab = useCallback(
    (tab: SettingsTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const activeDescription = tabs.find((tab) => tab.id === activeTab)?.description;

  return (
    <div className="space-y-3">
      <nav
        className="flex gap-1 overflow-x-auto border-b border-border pb-px"
        aria-label="Settings sections"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tab.id)}
              className={cn(
                'shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                active
                  ? 'border border-b-transparent border-border bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
      {activeDescription ? (
        <p className="text-sm text-muted-foreground">{activeDescription}</p>
      ) : null}
    </div>
  );
}

export function resolveSettingsTab(
  value: string | null,
  showAdmin: boolean,
): SettingsTabId {
  if (value === 'admin' && showAdmin) return 'admin';
  if (value === 'account') return 'account';
  if (value === 'notifications') return 'notifications';
  if (value === 'privacy') return 'privacy';
  return 'preferences';
}
