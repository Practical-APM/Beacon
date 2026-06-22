'use client';

import { useState } from 'react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';
import { Download, Trash2 } from 'lucide-react';

export function PrivacySettingsSection() {
  const { apiFetch, ready } = useApiClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [deletionNotes, setDeletionNotes] = useState('');

  async function exportData() {
    if (!ready) return;
    setBusy('export');
    setMessage(null);
    setError(null);
    try {
      const response = (await apiFetch('/v1/privacy/export', { method: 'POST' })) as {
        export: Record<string, unknown>;
      };
      const blob = new Blob([JSON.stringify(response.export, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `beacon-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Your data export has been downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  }

  async function requestDeletion(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy('delete');
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/privacy/deletion-request', {
        method: 'POST',
        body: JSON.stringify({ notes: deletionNotes || undefined }),
      });
      setMessage('Deletion request submitted. Our team will process it within 30 days.');
      setDeletionNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(null);
    }
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
        title="Export your data"
        description="Download a JSON copy of your account and organization data under GDPR."
        contentClassName="space-y-4"
      >
        <button
          type="button"
          disabled={!ready || busy !== null}
          onClick={() => void exportData()}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <Download className="h-4 w-4" aria-hidden />
          {busy === 'export' ? 'Preparing export…' : 'Download my data (JSON)'}
        </button>
      </AppSection>

      <AppSection
        title="Request deletion"
        description="Submit a deletion request. We process these within 30 days per GDPR requirements."
        className="border-destructive/20"
        contentClassName="space-y-4"
      >
        <form onSubmit={requestDeletion} className="space-y-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="form-label">Notes for our privacy team (optional)</span>
            <textarea
              className="form-input min-h-24"
              placeholder="Tell us anything we should know about your request"
              value={deletionNotes}
              onChange={(event) => setDeletionNotes(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={!ready || busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {busy === 'delete' ? 'Submitting…' : 'Request account deletion'}
          </button>
        </form>
      </AppSection>
    </div>
  );
}
