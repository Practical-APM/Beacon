'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { RequireAuth } from '@/components/require-auth';
import { TenantSwitcher } from '@/components/tenant-switcher';
import { useActiveMembership, useAppSession } from '@/components/providers/app-session-provider';
import { useApiClient } from '@/lib/use-api-client';
import { AppearanceSettingsSection } from '@/components/appearance-settings-section';
import { CurrencySettingsSection } from '@/components/currency-settings-section';
import { LanguageSettingsSection } from '@/components/language-settings-section';
import { NotificationPreferencesSection } from '@/components/notification-preferences-section';
import { SettingsPageHeader } from '@/components/settings-page-header';
import { NotificationAdminSettingsSection } from '@/components/notification-admin-settings-section';
import { PrivacySettingsSection } from '@/components/privacy-settings-section';
import { BenchmarkAdminSection } from '@/components/benchmark-admin-section';
import { ComplianceAdminSection } from '@/components/compliance-admin-section';
import { RiskRulesAdminSection } from '@/components/risk-rules-admin-section';
import { WebhookSubscriptionsSection } from '@/components/webhook-subscriptions-section';
import { GettingStartedResetSection } from '@/components/getting-started-reset-section';
import { CoreCrmPreferenceSection } from '@/components/integrations/core-crm-preference-section';
import { ContributorReadOnlyBanner } from '@/components/contributor-read-only-banner';
import { FeedbackBanner } from '@/components/feedback-banner';
import {
  resolveSettingsTab,
  SettingsTabs,
} from '@/components/settings/settings-tabs';

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const { me, activeTenantId, refreshMe, authDevMode } = useAppSession();
  const { apiFetch } = useApiClient();
  const membership = useActiveMembership();
  const isAdmin = membership?.role === 'admin';
  const activeTab = resolveSettingsTab(searchParams.get('tab'), isAdmin);

  const [orgName, setOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveOrgName(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/v1/tenants/${activeTenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: orgName }),
      });
      setMessage('Organization name updated.');
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/v1/tenants/${activeTenantId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: 'contributor' }),
      });
      setMessage(`Invitation sent to ${inviteEmail}.`);
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    }
  }

  const activeTenant = me?.memberships.find((item) => item.tenantId === activeTenantId);

  return (
    <div className="space-y-6">
      <SettingsPageHeader />
      <SettingsTabs showAdmin={isAdmin} activeTab={activeTab} />

      {!isAdmin && membership?.role === 'contributor' ? (
        <ContributorReadOnlyBanner
          context="organization settings and admin controls"
          adminHint="You can update your preferences, notifications, and privacy requests. Integration and risk rule changes require an admin."
        />
      ) : null}

      <div className="space-y-6 pt-2">
        {activeTab === 'preferences' ? (
          <>
            <LanguageSettingsSection />
            <CurrencySettingsSection />
            <AppearanceSettingsSection />
          </>
        ) : null}

        {activeTab === 'account' ? (
          <>
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="settings-section">
                <h2 className="settings-section-title">Profile</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd>{me?.user.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{me?.user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Role</dt>
                    <dd>{membership?.role ?? '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="settings-section">
                <h2 className="settings-section-title">Organization</h2>
                <div className="mt-4 space-y-4">
                  <TenantSwitcher />
                  <p className="text-sm text-muted-foreground">
                    Active organization: {activeTenant?.tenantName ?? 'None selected'}
                  </p>
                  {isAdmin ? (
                    <form onSubmit={saveOrgName} className="space-y-3">
                      <label className="flex flex-col gap-2">
                        <span className="form-label">Organization name</span>
                        <input
                          className="form-input"
                          value={orgName}
                          onChange={(event) => setOrgName(event.target.value)}
                          placeholder={activeTenant?.tenantName ?? 'Organization name'}
                        />
                      </label>
                      <button type="submit" className="btn-primary">
                        Save organization
                      </button>
                    </form>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Only admins can update organization settings.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h2 className="settings-section-title">Legal</h2>
              <p className="settings-section-lead">
                Review and accept the Data Processing Agreement for your organization.
              </p>
              <p className="mt-3 text-sm">
                Status:{' '}
                {me?.user.dpaCurrent ? (
                  <span className="text-success">Current DPA accepted</span>
                ) : (
                  <span className="text-amber-500">Acceptance required</span>
                )}
              </p>
              <Link href="/legal/dpa" className="btn-secondary mt-4 inline-flex">
                View DPA
              </Link>
            </section>

            {isAdmin ? (
              <section className="settings-section">
                <h2 className="settings-section-title">Invite teammate</h2>
                <p className="settings-section-lead">
                  Add contributors to your organization workspace.
                </p>
                <form onSubmit={sendInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    className="form-input flex-1"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="colleague@company.com"
                    required
                  />
                  <button type="submit" className="btn-primary sm:shrink-0">
                    Send invite
                  </button>
                </form>
              </section>
            ) : null}

            {authDevMode ? <GettingStartedResetSection /> : null}
          </>
        ) : null}

        {activeTab === 'notifications' ? <NotificationPreferencesSection /> : null}

        {activeTab === 'privacy' ? <PrivacySettingsSection /> : null}

        {activeTab === 'admin' && isAdmin ? (
          <>
            <CoreCrmPreferenceSection apiFetch={apiFetch} isAdmin={isAdmin} />
            <NotificationAdminSettingsSection />
            <RiskRulesAdminSection />
            <ComplianceAdminSection />
            <BenchmarkAdminSection />
            <WebhookSubscriptionsSection />
          </>
        ) : null}

        {message ? (
          <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
        ) : null}
        {error ? (
          <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
        ) : null}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
          <SettingsPageContent />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
