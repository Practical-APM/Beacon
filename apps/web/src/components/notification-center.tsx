'use client';

import Link from 'next/link';
import { Bell, Inbox, Mail, Server, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from '@/lib/use-api-client';
import { formatRelativeUpdated } from '@/lib/format';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt?: string | null;
  createdAt: string;
  metadata?: { projectId?: string };
}

function notificationIcon(type: string) {
  switch (type) {
    case 'immediate_alert':
      return Zap;
    case 'daily_digest':
      return Mail;
    default:
      return Server;
  }
}

function notificationLabel(type: string): string {
  switch (type) {
    case 'immediate_alert':
      return 'Risk alert';
    case 'daily_digest':
      return 'Daily digest';
    default:
      return 'System';
  }
}

export function NotificationCenter() {
  const { apiFetch, ready } = useApiClient();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      const [countResponse, listResponse] = await Promise.all([
        apiFetch<{ count: number }>('/v1/notifications/unread-count'),
        apiFetch<{ data: NotificationItem[] }>('/v1/notifications'),
      ]);
      setCount(countResponse.count);
      setItems(listResponse.data);
    } catch {
      setCount(0);
    }
  }, [apiFetch, ready]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      await apiFetch(`/v1/notifications/${item.id}/read`, { method: 'PATCH' });
      await refresh();
    }
    setOpen(false);
  }

  async function markAllRead() {
    await apiFetch('/v1/notifications/read-all', { method: 'POST' });
    await refresh();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative rounded-md border border-border p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium">Notifications</p>
            {count > 0 ? (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Inbox className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">No notifications yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Risk alerts and sync updates will appear here.
                </p>
                <Link
                  href="/settings?tab=notifications"
                  className="mt-4 inline-flex text-xs font-medium text-primary hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Configure alert preferences
                </Link>
              </div>
            ) : (
              items.map((item) => {
                const Icon = notificationIcon(item.type);
                const href = item.metadata?.projectId
                  ? `/projects/${item.metadata.projectId}`
                  : '/dashboard';
                return (
                  <div
                    key={item.id}
                    className={`border-b border-border/60 px-4 py-3 text-sm ${item.readAt ? 'opacity-70' : 'bg-primary/[0.02]'}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          item.type === 'immediate_alert'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        aria-hidden
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {notificationLabel(item.type)}
                          </span>
                        </p>
                        <p className="mt-1 text-muted-foreground">{item.body}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {formatRelativeUpdated(item.createdAt)}
                          </span>
                          <div className="flex gap-2">
                            <Link
                              href={href}
                              className="font-medium text-primary hover:underline"
                              onClick={() => void openNotification(item)}
                            >
                              {item.metadata?.projectId ? 'Open project' : 'Dashboard'}
                            </Link>
                            {!item.readAt ? (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  void apiFetch(`/v1/notifications/${item.id}/read`, {
                                    method: 'PATCH',
                                  }).then(() => refresh())
                                }
                              >
                                Mark read
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
