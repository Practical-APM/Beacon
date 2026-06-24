'use client';

import { useCallback, useEffect, useState } from 'react';
import { CoreCrmPicker, type CoreCrmPreferenceState } from '@/components/integrations/core-crm-picker';
import { FeedbackBanner } from '@/components/feedback-banner';

export function CoreCrmPreferenceSection({
  apiFetch,
  isAdmin,
  onUpdated,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<unknown>;
  isAdmin: boolean;
  onUpdated?: () => void;
}) {
  const [preference, setPreference] = useState<CoreCrmPreferenceState | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiFetch('/v1/integrations/core-crm/preference')) as CoreCrmPreferenceState;
      setPreference(data);
      setSelectedId(data.coreCrmId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CRM preference');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function savePreference(coreCrmId: string) {
    if (!isAdmin || preference?.locked) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const data = (await apiFetch('/v1/integrations/core-crm/preference', {
        method: 'PATCH',
        body: JSON.stringify({ coreCrmId }),
      })) as CoreCrmPreferenceState;
      setPreference(data);
      setSelectedId(data.coreCrmId);
      setMessage(`Core CRM set to ${data.coreCrmName}.`);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update CRM preference');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !preference) {
    return (
      <section className="settings-section">
        <p className="text-sm text-muted-foreground">Loading CRM preference…</p>
      </section>
    );
  }

  if (!preference) return null;

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Core CRM</h2>
      <p className="settings-section-lead">
        Choose which CRM drives project imports and core setup. Additional CRMs can be added to the
        catalog as they ship — your preference applies across setup, sync, and readiness checks.
      </p>

      {message ? <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} /> : null}
      {error ? <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} /> : null}
      {preference.locked && preference.lockedReason ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {preference.lockedReason}
        </div>
      ) : null}

      <div className="mt-6">
        <CoreCrmPicker
          preference={preference}
          selectedId={selectedId}
          disabled={!isAdmin || saving}
          onSelect={(coreCrmId) => {
            setSelectedId(coreCrmId);
            if (coreCrmId !== preference.coreCrmId) {
              void savePreference(coreCrmId);
            }
          }}
        />
      </div>

      {!isAdmin ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Only admins can change the workspace core CRM.
        </p>
      ) : null}
    </section>
  );
}
