import Link from 'next/link';
import { Calendar, Cloud, Hash, Layers, Server } from 'lucide-react';
import { AppSection } from '@/components/app-section';
import { formatTimelineEvent, timelineDeepLink } from '@/lib/evidence-links';
import { cn } from '@/lib/utils';

const SOURCE_CONFIG = {
  salesforce: { icon: Cloud, label: 'Salesforce', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  jira: { icon: Layers, label: 'Jira', className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  slack: { icon: Hash, label: 'Slack', className: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  system: { icon: Server, label: 'System', className: 'bg-muted text-muted-foreground' },
} as const;

function formatDateHeader(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function groupEventsByDay<T extends { occurredAt: string }>(
  events: T[],
): Array<{ label: string; events: T[] }> {
  const groups = new Map<string, T[]>();
  for (const event of events) {
    const key = new Date(event.occurredAt).toDateString();
    const existing = groups.get(key) ?? [];
    existing.push(event);
    groups.set(key, existing);
  }
  return [...groups.entries()].map(([, dayEvents]) => ({
    label: formatDateHeader(dayEvents[0]!.occurredAt),
    events: dayEvents,
  }));
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectTimeline({
  events,
  loading,
}: {
  events: Array<{
    id: string;
    eventType: string;
    source: string;
    occurredAt: string;
    externalId?: string | null;
    payload?: Record<string, unknown> | null;
  }>;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <AppSection
        id="activity-timeline"
        title="Activity timeline"
        description="Last 30 days"
        className="scroll-mt-24"
      >
        <TimelineSkeleton />
      </AppSection>
    );
  }

  const grouped = groupEventsByDay(events);

  return (
    <AppSection
      id="activity-timeline"
      title="Activity timeline"
      description="Last 30 days of signals from connected systems"
      contentClassName="space-y-6"
      className="scroll-mt-24"
    >
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <Calendar className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">No activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Events from Salesforce, Jira, and Slack will appear here as they sync.
          </p>
          <Link href="/integrations" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
            Check connection status
          </Link>
          <Link
            href="/docs?guide=connect-stack&step=1"
            className="mt-2 block text-sm font-medium text-primary hover:underline"
          >
            Improve signal coverage
          </Link>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.label}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h3>
            <ol className="relative space-y-0">
              {group.events.map((event, index) => {
                const config =
                  SOURCE_CONFIG[event.source as keyof typeof SOURCE_CONFIG] ?? SOURCE_CONFIG.system;
                const Icon = config.icon;
                const deepLink = timelineDeepLink(event);
                const isLast = index === group.events.length - 1;

                return (
                  <li key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
                    {!isLast ? (
                      <span
                        className="absolute left-[17px] top-9 h-[calc(100%-1.25rem)] w-px bg-border"
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={cn(
                        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        config.className,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm leading-relaxed">{formatTimelineEvent(event)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(
                            new Date(event.occurredAt),
                          )}
                        </span>
                        <span className="capitalize">{config.label}</span>
                        {deepLink ? (
                          <a
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            Open in {event.source}
                          </a>
                        ) : event.externalId ? (
                          <span>Source record unavailable</span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}
    </AppSection>
  );
}
