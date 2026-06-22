'use client';

import { AppShell } from '@/components/app-shell';
import { RequireAuth } from '@/components/require-auth';
import { OnboardingWizard } from './onboarding-wizard';

export default function IntegrationsSetupPage() {
  return (
    <RequireAuth>
      <AppShell>
        <OnboardingWizard />
      </AppShell>
    </RequireAuth>
  );
}
