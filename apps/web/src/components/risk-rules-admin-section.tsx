'use client';

import { RISK_LEVELS } from '@beacon/shared/constants';
import { useCallback, useEffect, useState } from 'react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';

type RuleConfig = {
  enabled: boolean;
  level: (typeof RISK_LEVELS)[number];
  baseScore: number;
  thresholdBusinessDays?: number;
};

type RuleRow = {
  key: string;
  label: string;
  description: string;
  supportsThreshold: boolean;
  config: RuleConfig;
};

type RiskRulesResponse = {
  timezone: string;
  hysteresisBuffer: number;
  acknowledgedSuppressionDays: number;
  rules: RuleRow[];
};

export function RiskRulesAdminSection() {
  const { apiFetch, ready } = useApiClient();
  const [rulesState, setRulesState] = useState<RiskRulesResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    const response = await apiFetch<{ rules: RiskRulesResponse }>('/v1/admin/risk-rules');
    setRulesState(response.rules);
  }, [apiFetch, ready]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load risk rules'));
  }, [load]);

  function updateRule(key: string, patch: Partial<RuleConfig>) {
    if (!rulesState) return;
    setRulesState({
      ...rulesState,
      rules: rulesState.rules.map((rule) =>
        rule.key === key ? { ...rule, config: { ...rule.config, ...patch } } : rule,
      ),
    });
  }

  async function saveRules(event: React.FormEvent) {
    event.preventDefault();
    if (!rulesState) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/admin/risk-rules', {
        method: 'PATCH',
        body: JSON.stringify({
          timezone: rulesState.timezone,
          hysteresisBuffer: rulesState.hysteresisBuffer,
          acknowledgedSuppressionDays: rulesState.acknowledgedSuppressionDays,
          rules: Object.fromEntries(
            rulesState.rules.map((rule) => [rule.key, rule.config]),
          ),
        }),
      });
      setMessage('Risk rules saved. Re-evaluation started in the background.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function resetRules() {
    if (!window.confirm('Reset all risk rules to platform defaults?')) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/admin/risk-rules/reset', { method: 'POST' });
      setMessage('Risk rules reset to defaults.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  }

  if (!rulesState) {
    return <p className="text-sm text-muted-foreground">Loading risk rules…</p>;
  }

  return (
    <AppSection
      title="Custom risk rules"
      description="Tune tenant rule thresholds, severity, and enablement. Changes trigger a risk re-evaluation."
      contentClassName="space-y-6"
    >
      {message ? (
        <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
      ) : null}
      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void resetRules()}
          disabled={saving}
          className="btn-secondary text-xs"
        >
          Reset to defaults
        </button>
      </div>

      <form onSubmit={saveRules} className="space-y-6">
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
          <p className="font-medium">Global rule settings</p>
          <p className="mt-1 text-muted-foreground">
            These apply to every risk rule. Timezone affects business-day calculations. Hysteresis
            stops severity from flipping when a score sits near a threshold. Ack suppression hides
            acknowledged risks for the number of days you set.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="form-label">Timezone</span>
            <input
              className="form-input"
              value={rulesState.timezone}
              onChange={(event) =>
                setRulesState({ ...rulesState, timezone: event.target.value })
              }
              placeholder="America/New_York"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="form-label">Hysteresis buffer</span>
            <input
              type="number"
              min={0}
              max={20}
              className="form-input"
              value={rulesState.hysteresisBuffer}
              onChange={(event) =>
                setRulesState({
                  ...rulesState,
                  hysteresisBuffer: Number(event.target.value),
                })
              }
            />
            <span className="text-xs text-muted-foreground">Score points before severity changes</span>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="form-label">Ack suppression (days)</span>
            <input
              type="number"
              min={1}
              max={30}
              className="form-input"
              value={rulesState.acknowledgedSuppressionDays}
              onChange={(event) =>
                setRulesState({
                  ...rulesState,
                  acknowledgedSuppressionDays: Number(event.target.value),
                })
              }
            />
            <span className="text-xs text-muted-foreground">Hide acknowledged risks from feed</span>
          </label>
        </div>

        <div className="space-y-4">
          {rulesState.rules.map((rule) => (
            <div key={rule.key} className="rounded-md border border-border/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{rule.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rule.config.enabled}
                    onChange={(event) => updateRule(rule.key, { enabled: event.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm">
                  Severity
                  <select
                    className="form-input"
                    value={rule.config.level}
                    onChange={(event) =>
                      updateRule(rule.key, {
                        level: event.target.value as RuleConfig['level'],
                      })
                    }
                  >
                    {RISK_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Base score
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="form-input"
                    value={rule.config.baseScore}
                    onChange={(event) =>
                      updateRule(rule.key, { baseScore: Number(event.target.value) })
                    }
                  />
                </label>
                {rule.supportsThreshold ? (
                  <label className="flex flex-col gap-2 text-sm">
                    Threshold (business days)
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className="form-input"
                      value={rule.config.thresholdBusinessDays ?? 10}
                      onChange={(event) =>
                        updateRule(rule.key, {
                          thresholdBusinessDays: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save risk rules'}
        </button>
      </form>
    </AppSection>
  );
}
