'use client';

import Link from 'next/link';
import { Check, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CatalogIntegrationItem = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  availability: 'available' | 'coming_soon' | 'beta';
  setupRole: string;
  description: string;
  signals: readonly string[];
  anchor?: string;
  connectPath?: string;
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing' | 'not_applicable';
  connected: boolean;
};

export type CatalogCategory = {
  id: string;
  label: string;
  integrations: CatalogIntegrationItem[];
};

const STATUS_LABEL: Record<CatalogIntegrationItem['status'], string | null> = {
  connected: 'Connected',
  degraded: 'Needs attention',
  disconnected: 'Not connected',
  syncing: 'Syncing',
  not_applicable: null,
};

export function IntegrationCatalogGrid({
  categories,
  showComingSoon = true,
  isAdmin = false,
  onConnect,
  connectBusyId,
}: {
  categories: CatalogCategory[];
  showComingSoon?: boolean;
  isAdmin?: boolean;
  onConnect?: (catalogId: string) => void;
  connectBusyId?: string | null;
}) {
  return (
    <div className="space-y-8">
      {categories.map((category) => {
        const items = showComingSoon
          ? category.integrations
          : category.integrations.filter((item) => item.availability === 'available');

        if (items.length === 0) return null;

        return (
          <section key={category.id}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {category.label}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <CatalogCard
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  onConnect={onConnect}
                  connectBusy={connectBusyId === item.id}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CatalogCard({
  item,
  isAdmin,
  onConnect,
  connectBusy,
}: {
  item: CatalogIntegrationItem;
  isAdmin?: boolean;
  onConnect?: (catalogId: string) => void;
  connectBusy?: boolean;
}) {
  const isComingSoon = item.availability === 'coming_soon';
  const isBeta = item.availability === 'beta';
  const statusLabel = STATUS_LABEL[item.status];
  const canConnect =
    isAdmin &&
    !isComingSoon &&
    !item.connected &&
    item.availability === 'available' &&
    Boolean(item.connectPath) &&
    Boolean(onConnect);
  const href =
    item.anchor && !isComingSoon && (item.connected || !canConnect)
      ? `/integrations${item.anchor}`
      : undefined;

  const card = (
    <article
      className={cn(
        'flex h-full flex-col rounded-xl border p-4 transition-colors',
        isComingSoon
          ? 'border-dashed border-border bg-muted/20'
          : item.connected
            ? 'border-primary/25 bg-primary/[0.03] hover:bg-accent/30'
            : 'border-border hover:bg-accent/30',
        href && 'cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-foreground">{item.name}</h4>
          {isComingSoon ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden />
              Roadmap
            </span>
          ) : isBeta ? (
            <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Beta
            </span>
          ) : statusLabel ? (
            <span
              className={cn(
                'mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                item.connected
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
        {item.connected && !isComingSoon ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : isComingSoon ? (
          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      <p className="mt-3 flex-1 text-sm text-muted-foreground">{item.description}</p>

      <ul className="mt-3 space-y-1">
        {item.signals.slice(0, 3).map((signal) => (
          <li key={signal} className="text-xs text-muted-foreground">
            · {signal}
          </li>
        ))}
      </ul>

      {canConnect ? (
        <button
          type="button"
          disabled={connectBusy}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onConnect?.(item.id);
          }}
          className="btn-primary mt-4 w-full px-3 py-2 text-xs"
        >
          {connectBusy ? 'Connecting…' : `Connect ${item.name}`}
        </button>
      ) : href ? (
        <span className="mt-4 text-xs font-medium text-primary">Configure →</span>
      ) : isComingSoon ? (
        <Link
          href="/docs#integrations"
          className="mt-4 inline-flex text-xs font-medium text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          On the integration roadmap →
        </Link>
      ) : null}
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl">
        {card}
      </Link>
    );
  }

  return card;
}
