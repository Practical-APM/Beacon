'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Radio,
  XCircle,
} from 'lucide-react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';
import { formatRelativeUpdated } from '@/lib/format';
import { cn } from '@/lib/utils';

const RISK_EVENT_TYPES = ['risk.created', 'risk.updated', 'risk.escalated', 'risk.resolved'] as const;

interface WebhookSubscription {
  id: string;
  url: string;
  description: string | null;
  enabled: boolean;
  eventTypes: string[];
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventType: string;
  status: string;
  responseStatus: number | null;
  errorMessage: string | null;
  createdAt: string;
}

function subscriptionHealth(sub: WebhookSubscription): 'healthy' | 'failing' | 'disabled' {
  if (!sub.enabled) return 'disabled';
  if (sub.consecutiveFailures > 0) return 'failing';
  if (
    sub.lastFailureAt &&
    (!sub.lastSuccessAt || new Date(sub.lastFailureAt) > new Date(sub.lastSuccessAt))
  ) {
    return 'failing';
  }
  return 'healthy';
}

const HEALTH_CONFIG = {
  healthy: {
    label: 'Delivering',
    icon: CheckCircle2,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  },
  failing: {
    label: 'Failing',
    icon: AlertTriangle,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  },
  disabled: {
    label: 'Disabled',
    icon: XCircle,
    className: 'border-border bg-muted/40 text-muted-foreground',
  },
};

export function WebhookSubscriptionsSection() {
  const { apiFetch, ready } = useApiClient();
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const [subsRes, deliveriesRes] = await Promise.all([
        apiFetch<{ data: WebhookSubscription[] }>('/v1/admin/webhooks'),
        apiFetch<{ data: WebhookDelivery[] }>('/v1/admin/webhooks/deliveries?limit=20'),
      ]);
      setSubscriptions(subsRes.data);
      setDeliveries(deliveriesRes.data);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, ready]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load webhooks'));
  }, [load]);

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }

  async function createSubscription(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    setNewSecret(null);
    setSecretCopied(false);
    try {
      const result = await apiFetch<{ subscription: WebhookSubscription; secret: string }>(
        '/v1/admin/webhooks',
        {
          method: 'POST',
          body: JSON.stringify({ url, description: description || undefined }),
        },
      );
      setNewSecret(result.secret);
      setUrl('');
      setDescription('');
      setMessage('Webhook created. Copy the signing secret below — it is shown only once.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleSubscription(subscription: WebhookSubscription) {
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/v1/admin/webhooks/${subscription.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !subscription.enabled }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function testSubscription(subscriptionId: string) {
    setMessage(null);
    setError(null);
    try {
      const result = await apiFetch<{ delivered: boolean; error?: string }>(
        `/v1/admin/webhooks/${subscriptionId}/test`,
        { method: 'POST' },
      );
      setMessage(result.delivered ? 'Test event delivered successfully.' : result.error ?? 'Test delivery failed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    }
  }

  async function deleteSubscription(subscriptionId: string) {
    if (!window.confirm('Delete this webhook subscription?')) return;
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/v1/admin/webhooks/${subscriptionId}`, { method: 'DELETE' });
      setMessage('Webhook subscription deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const failingCount = subscriptions.filter((s) => subscriptionHealth(s) === 'failing').length;

  return (
    <AppSection
      title="Outbound webhooks"
      description="Push risk events to PagerDuty, Slack workflows, or your internal automation. Each request is signed with HMAC-SHA256."
      contentClassName="space-y-6"
    >
      {message ? (
        <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
      ) : null}
      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      {failingCount > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {failingCount} endpoint{failingCount === 1 ? '' : 's'} failing delivery. Check recent
            deliveries below for HTTP status codes and error messages.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
        <p className="font-medium">Events sent</p>
        <p className="mt-1 text-muted-foreground">
          {RISK_EVENT_TYPES.join(', ')}. Verify signatures with the{' '}
          <code className="rounded bg-muted px-1 text-xs">X-Beacon-Signature</code> header.
        </p>
      </div>

      <form onSubmit={createSubscription} className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Add endpoint</p>
        <label className="flex flex-col gap-2 text-sm">
          <span className="form-label">Endpoint URL</span>
          <input
            className="form-input"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://hooks.example.com/beacon"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="form-label">Description (optional)</span>
          <input
            className="form-input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="PagerDuty, internal risk router, etc."
          />
        </label>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Creating…' : 'Add webhook'}
        </button>
      </form>

      {newSecret ? (
        <div className="motion-safe:animate-fade-in rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Signing secret — copy now
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Store this in your secrets manager. It cannot be retrieved later.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-background/80 px-3 py-2 text-xs">
              {newSecret}
            </code>
            <button type="button" onClick={() => void copySecret()} className="btn-secondary shrink-0">
              <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {secretCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-medium">Active endpoints</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading webhooks…</p>
        ) : subscriptions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <Radio className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden />
            <p className="mt-3 text-sm font-medium">No webhooks configured</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Route critical and high-risk events to on-call systems without polling the API.
            </p>
          </div>
        ) : (
          subscriptions.map((subscription) => {
            const health = subscriptionHealth(subscription);
            const config = HEALTH_CONFIG[health];
            const Icon = config.icon;
            return (
              <article
                key={subscription.id}
                className={cn(
                  'rounded-xl border p-4 text-sm transition-shadow',
                  health === 'failing' ? 'border-amber-500/30' : 'border-border',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-all">{subscription.url}</p>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                          config.className,
                        )}
                      >
                        <Icon className="h-3 w-3" aria-hidden />
                        {config.label}
                      </span>
                    </div>
                    {subscription.description ? (
                      <p className="mt-1 text-muted-foreground">{subscription.description}</p>
                    ) : null}
                    <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      {subscription.lastSuccessAt ? (
                        <div>
                          Last success: {formatRelativeUpdated(subscription.lastSuccessAt)}
                        </div>
                      ) : null}
                      {subscription.lastFailureAt ? (
                        <div>
                          Last failure: {formatRelativeUpdated(subscription.lastFailureAt)}
                        </div>
                      ) : null}
                      {subscription.consecutiveFailures > 0 ? (
                        <div className="text-amber-800 dark:text-amber-200">
                          {subscription.consecutiveFailures} consecutive failures
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void testSubscription(subscription.id)}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      Send test
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleSubscription(subscription)}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      {subscription.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSubscription(subscription.id)}
                      className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {deliveries.length > 0 ? (
        <div>
          <p className="text-sm font-medium">Recent deliveries</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use this log to debug 4xx/5xx responses from your endpoint.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-4 py-2.5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => {
                  const failed =
                    delivery.status === 'failed' ||
                    (delivery.responseStatus != null && delivery.responseStatus >= 400);
                  return (
                    <tr
                      key={delivery.id}
                      className={cn(
                        'border-b border-border/60 last:border-0',
                        failed && 'bg-destructive/[0.03]',
                      )}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {formatRelativeUpdated(delivery.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{delivery.eventType}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'font-medium',
                            failed ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {delivery.status}
                          {delivery.responseStatus ? ` (${delivery.responseStatus})` : ''}
                        </span>
                        {delivery.errorMessage ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{delivery.errorMessage}</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Need payload examples? See{' '}
        <a
          href="/docs"
          className="inline-flex items-center gap-0.5 text-primary hover:underline"
        >
          documentation
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        .
      </p>
    </AppSection>
  );
}
