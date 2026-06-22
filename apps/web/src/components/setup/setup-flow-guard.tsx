'use client';

import { AuthLoadingScreen } from '@/components/auth-loading-screen';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useActiveMembership, useAppSession } from '@/components/providers/app-session-provider';
import { fetchSetupState, type SetupState } from '@/lib/setup-orchestrator';
import { useApiClient } from '@/lib/use-api-client';

const SETUP_PATHS = ['/integrations/setup', '/integrations'];

export function SetupFlowGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { apiFetch, ready } = useApiClient();
  const membership = useActiveMembership();
  const { activeTenantId } = useAppSession();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = membership?.role === 'admin';
  const onSetupPath = SETUP_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const onDashboard = pathname === '/dashboard' || pathname.startsWith('/projects/');

  useEffect(() => {
    if (!ready || !activeTenantId || !isAdmin || !onDashboard) {
      setChecked(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setError(null);
        const state = (await fetchSetupState(apiFetch)) as SetupState;
        if (cancelled) return;
        if (state.phase !== 'ready' && !onSetupPath) {
          router.replace('/integrations/setup');
          return;
        }
        if (state.phase === 'ready' && pathname === '/integrations/setup') {
          router.replace('/dashboard');
          return;
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Could not verify workspace setup. Try again.';
          setError(message);
        }
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTenantId, apiFetch, isAdmin, onDashboard, onSetupPath, pathname, ready, router]);

  if (!checked && isAdmin && onDashboard) {
    return <AuthLoadingScreen label="Checking workspace setup…" />;
  }

  return (
    <>
      {error ? (
        <div className="mb-4">
          <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
      {children}
    </>
  );
}
