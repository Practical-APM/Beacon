'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';
import { formatRelativeUpdated } from '@/lib/format';

interface AuditEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface DeletionRequest {
  id: string;
  status: string;
  requestedAt: string;
  notes: string | null;
  userId: string;
}

interface FeatureFlags {
  llmEnabled: boolean;
  slackAlertsEnabled: boolean;
  outboundWebhooksEnabled: boolean;
  benchmarkParticipationEnabled: boolean;
  delayPredictionsEnabled: boolean;
}

interface FeedbackSummary {
  total: number;
  helpful: number;
  notHelpful: number;
  helpfulRate: number;
}

const FLAG_HELP: Record<keyof FeatureFlags, { label: string; why: string }> = {
  llmEnabled: {
    label: 'LLM insights',
    why: 'Generates plain-language explanations on project risk panels. Turn off for tenants that prohibit external LLM calls.',
  },
  slackAlertsEnabled: {
    label: 'Internal Slack alerts',
    why: 'Posts critical and high-risk events to your configured Slack workspace for on-call visibility.',
  },
  outboundWebhooksEnabled: {
    label: 'Outbound webhooks',
    why: 'Allows signed risk event delivery to PagerDuty, custom routers, or automation endpoints.',
  },
  benchmarkParticipationEnabled: {
    label: 'Benchmark participation',
    why: 'Contributes anonymized portfolio metrics to peer percentile comparisons on the dashboard.',
  },
  delayPredictionsEnabled: {
    label: 'Delay predictions',
    why: 'Shows predicted slip days on risks and project overview. Disable if you only want rule-based signals.',
  },
};

export function ComplianceAdminSection() {
  const { apiFetch, ready } = useApiClient();
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    const [auditRes, deletionRes, flagsRes, feedbackRes] = await Promise.all([
      apiFetch<{ data: AuditEvent[] }>('/v1/admin/audit-events?limit=20'),
      apiFetch<{ data: DeletionRequest[] }>('/v1/admin/privacy/deletion-requests'),
      apiFetch<{ flags: FeatureFlags }>('/v1/admin/feature-flags'),
      apiFetch<{ summary: FeedbackSummary }>('/v1/admin/feedback/summary'),
    ]);
    setAuditEvents(auditRes.data);
    setDeletionRequests(deletionRes.data);
    setFlags(flagsRes.flags);
    setFeedbackSummary(feedbackRes.summary);
  }, [apiFetch, ready]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load compliance data'));
  }, [load]);

  async function saveFlags(event: React.FormEvent) {
    event.preventDefault();
    if (!flags) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/admin/feature-flags', {
        method: 'PATCH',
        body: JSON.stringify(flags),
      });
      setMessage('Feature flags saved. Some changes may take a sync cycle to apply.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function processDeletionRequest(requestId: string, action: 'complete' | 'reject') {
    setProcessingRequestId(requestId);
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/v1/admin/privacy/deletion-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      setMessage(
        action === 'complete'
          ? 'Deletion request completed. User data in this workspace has been anonymized.'
          : 'Deletion request rejected.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deletion request');
    } finally {
      setProcessingRequestId(null);
    }
  }

  if (!flags) {
    return <p className="text-sm text-muted-foreground">Loading compliance settings…</p>;
  }

  return (
    <div className="space-y-6">
      {message ? (
        <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
      ) : null}
      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      <AppSection
        title="Feature flags"
        description="Tenant-level toggles for AI, alerts, webhooks, and benchmarking. Changes apply to all users in this workspace."
        contentClassName="space-y-4"
      >
        <form onSubmit={saveFlags} className="space-y-4">
          {(Object.keys(FLAG_HELP) as Array<keyof FeatureFlags>).map((key) => {
            const help = FLAG_HELP[key];
            return (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/20"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={flags[key]}
                  onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium">{help.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{help.why}</span>
                </span>
              </label>
            );
          })}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save feature flags'}
          </button>
        </form>
      </AppSection>

      {feedbackSummary ? (
        <AppSection
          title="Recommendation feedback"
          description="Pilot training signal from helpful / not helpful ratings on AI explanations."
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-border px-4 py-3">
              <dt className="text-muted-foreground">Total ratings</dt>
              <dd className="mt-1 text-lg font-medium">{feedbackSummary.total}</dd>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <dt className="text-muted-foreground">Helpful rate</dt>
              <dd className="mt-1 text-lg font-medium">
                {Math.round(feedbackSummary.helpfulRate * 100)}%
              </dd>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <dt className="text-muted-foreground">Not helpful</dt>
              <dd className="mt-1 text-lg font-medium">{feedbackSummary.notHelpful}</dd>
            </div>
          </dl>
          {feedbackSummary.total === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No ratings yet. Feedback appears when users rate AI explanations on project pages.
            </p>
          ) : null}
        </AppSection>
      ) : null}

      <AppSection
        title="Audit log"
        description="Recent integration, risk, and privacy events for compliance review."
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Resource</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    No audit events yet. Events appear when integrations sync or risks change.
                  </td>
                </tr>
              ) : (
                auditEvents.map((event) => (
                  <tr key={event.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {formatRelativeUpdated(event.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{event.action.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5">
                      {event.resourceType}
                      {event.resourceId ? ` · ${event.resourceId.slice(0, 8)}…` : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AppSection>

      <AppSection
        title="Deletion requests"
        description="GDPR and privacy deletion requests submitted by users in this workspace."
      >
        {deletionRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending deletion requests. Users can submit requests from Settings → Privacy.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {deletionRequests.map((request) => (
              <li key={request.id} className="rounded-lg border border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-medium capitalize">{request.status}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {formatRelativeUpdated(request.requestedAt)}
                    </span>
                    {request.notes ? (
                      <p className="mt-1 text-muted-foreground">{request.notes}</p>
                    ) : null}
                  </div>
                  {request.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={processingRequestId === request.id}
                        onClick={() => void processDeletionRequest(request.id, 'complete')}
                      >
                        {processingRequestId === request.id ? 'Processing…' : 'Complete deletion'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={processingRequestId === request.id}
                        onClick={() => void processDeletionRequest(request.id, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppSection>
    </div>
  );
}
