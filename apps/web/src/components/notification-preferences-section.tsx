'use client';

import Link from 'next/link';
import { RISK_LEVELS } from '@beacon/shared/constants';
import { NOTIFICATION_FREQUENCIES } from '@beacon/shared/notifications';
import { useCallback, useEffect, useState } from 'react';
import { Bell, Mail, MessageSquare, Moon } from 'lucide-react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';
import { cn } from '@/lib/utils';

interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  slackEnabled: boolean;
  frequency: string;
  minSeverity: string;
  minConfidence: number;
  digestHourLocal: number;
  timezone?: string;
  globalSnoozeUntil?: string | null;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily digest',
  immediate_only: 'Immediate alerts only',
  off: 'Off',
};

const CHANNELS = [
  {
    key: 'emailEnabled' as const,
    label: 'Email',
    description: 'Digests and critical alerts to your inbox',
    icon: Mail,
  },
  {
    key: 'inAppEnabled' as const,
    label: 'In-app',
    description: 'Bell icon notifications inside Beacon',
    icon: Bell,
  },
  {
    key: 'slackEnabled' as const,
    label: 'Internal Slack',
    description: 'Alerts to your team workspace channels',
    icon: MessageSquare,
  },
];

function PreferencesSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-40 rounded-xl border border-border bg-card" />
    </div>
  );
}

export function NotificationPreferencesSection() {
  const { apiFetch, ready } = useApiClient();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    const response = (await apiFetch('/v1/notifications/preferences')) as {
      preferences: NotificationPreferences;
    };
    setPrefs(response.preferences);
  }, [apiFetch, ready]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load preferences'),
    );
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!prefs) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(prefs),
      });
      setMessage('Notification preferences saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) {
    return (
      <AppSection
        title="Notification preferences"
        description="Control daily digests, immediate alerts, channels, and vacation snooze."
      >
        <PreferencesSkeleton />
      </AppSection>
    );
  }

  const snoozed =
    prefs.globalSnoozeUntil != null && new Date(prefs.globalSnoozeUntil) > new Date();

  return (
    <form onSubmit={save} className="space-y-6">
      {message ? (
        <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
      ) : null}
      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      <AppSection
        title="Delivery channels"
        description="Choose where Beacon sends implementation risk alerts."
        contentClassName="grid gap-3 sm:grid-cols-3"
      >
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const enabled = prefs[channel.key];
          return (
            <button
              key={channel.key}
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setPrefs({ ...prefs, [channel.key]: !enabled })}
              className={cn(
                'rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                enabled
                  ? 'border-primary/40 bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/25',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    enabled
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {enabled ? 'On' : 'Off'}
                </span>
              </div>
              <p className="mt-3 font-medium">{channel.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {channel.description}
              </p>
            </button>
          );
        })}
      </AppSection>

      <AppSection
        title="Alert rules"
        description="Filter which risks trigger notifications."
        contentClassName="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="form-label">Frequency</span>
          <select
            className="form-input"
            value={prefs.frequency}
            onChange={(event) => setPrefs({ ...prefs, frequency: event.target.value })}
          >
            {NOTIFICATION_FREQUENCIES.map((value) => (
              <option key={value} value={value}>
                {FREQUENCY_LABELS[value] ?? value.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">Minimum severity</span>
          <select
            className="form-input"
            value={prefs.minSeverity}
            onChange={(event) => setPrefs({ ...prefs, minSeverity: event.target.value })}
          >
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)} and above
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">Digest hour (local time)</span>
          <input
            type="number"
            min={0}
            max={23}
            className="form-input"
            value={prefs.digestHourLocal}
            onChange={(event) =>
              setPrefs({ ...prefs, digestHourLocal: Number(event.target.value) })
            }
          />
          <span className="text-xs text-muted-foreground">0–23, when daily digests are sent</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">Timezone</span>
          <input
            className="form-input"
            value={prefs.timezone ?? 'UTC'}
            onChange={(event) => setPrefs({ ...prefs, timezone: event.target.value })}
            placeholder="America/New_York"
          />
        </label>
        </div>
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          You will receive alerts for{' '}
          <span className="font-medium text-foreground">
            {prefs.minSeverity} severity and above
          </span>
          {prefs.frequency === 'off'
            ? ', but frequency is set to off.'
            : prefs.frequency === 'immediate_only'
              ? ' via immediate alerts.'
              : ' in your daily digest and immediate alerts.'}
        </p>
      </AppSection>

      <AppSection
        title="Vacation snooze"
        description="Pause all notifications until a specific date."
        contentClassName="space-y-3"
      >
        {snoozed ? (
          <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            <Moon className="h-4 w-4 shrink-0" aria-hidden />
            Notifications snoozed until{' '}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(prefs.globalSnoozeUntil!))}
          </p>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="form-label">Snooze until</span>
          <input
            type="datetime-local"
            className="form-input max-w-sm"
            value={
              prefs.globalSnoozeUntil
                ? new Date(prefs.globalSnoozeUntil).toISOString().slice(0, 16)
                : ''
            }
            onChange={(event) =>
              setPrefs({
                ...prefs,
                globalSnoozeUntil: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              })
            }
          />
          {prefs.globalSnoozeUntil ? (
            <button
              type="button"
              className="self-start text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setPrefs({ ...prefs, globalSnoozeUntil: null })}
            >
              Clear snooze
            </button>
          ) : null}
        </label>
      </AppSection>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save notification preferences'}
        </button>
        <Link href="/settings?tab=account" className="text-sm text-muted-foreground hover:text-foreground">
          Manage email unsubscribe links in Account
        </Link>
      </div>
    </form>
  );
}
