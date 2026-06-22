'use client';

import { RISK_LEVELS } from '@beacon/shared/constants';
import { useCallback, useEffect, useState } from 'react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';
import { cn } from '@/lib/utils';

interface TenantNotificationSettings {
  enabled: boolean;
  digestEnabled: boolean;
  immediateAlertsEnabled: boolean;
  orgMinSeverity: string;
}

const SETTING_HELP = [
  {
    key: 'enabled' as const,
    label: 'Notifications enabled',
    why: 'Master switch for all org-wide digests and immediate alerts. Turn off during maintenance or pilot pauses.',
  },
  {
    key: 'digestEnabled' as const,
    label: 'Daily digests',
    why: 'Morning portfolio summaries emailed to users who opt in. Respects each user’s channel preferences.',
  },
  {
    key: 'immediateAlertsEnabled' as const,
    label: 'Immediate alerts',
    why: 'Critical and high-risk events pushed in near real time. Use the severity floor below to reduce noise.',
  },
];

export function NotificationAdminSettingsSection() {
  const { apiFetch, ready } = useApiClient();
  const [settings, setSettings] = useState<TenantNotificationSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    const response = (await apiFetch('/v1/admin/notifications/settings')) as {
      settings: TenantNotificationSettings;
    };
    setSettings(response.settings);
  }, [apiFetch, ready]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'));
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/admin/notifications/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setMessage('Organization notification settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Loading organization notification settings…</p>;
  }

  return (
    <AppSection
      title="Organization notifications"
      description="Org-wide floor for alerts and digests. Individual users can still narrow their own preferences in Settings → Notifications."
      contentClassName="space-y-4"
    >
      {message ? (
        <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
      ) : null}
      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      {!settings.enabled ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Notifications are disabled for this organization. Users will not receive digests or
          alerts until re-enabled.
        </div>
      ) : null}

      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {SETTING_HELP.map((item) => (
            <button
              key={item.key}
              type="button"
              role="switch"
              aria-checked={settings[item.key]}
              onClick={() => setSettings({ ...settings, [item.key]: !settings[item.key] })}
              className={cn(
                'rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                settings[item.key]
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border hover:border-primary/25',
              )}
            >
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  settings[item.key]
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {settings[item.key] ? 'On' : 'Off'}
              </span>
              <p className="mt-2 text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.why}</p>
            </button>
          ))}
        </div>

        <label className="flex max-w-sm flex-col gap-2 text-sm">
          <span className="form-label">Minimum severity (org floor)</span>
          <select
            className="form-input"
            value={settings.orgMinSeverity}
            onChange={(event) => setSettings({ ...settings, orgMinSeverity: event.target.value })}
          >
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)} and above
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Alerts below this severity are never sent, even if a user wants them.
          </span>
        </label>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save organization settings'}
        </button>
      </form>
    </AppSection>
  );
}
