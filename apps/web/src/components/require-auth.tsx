'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLoadingScreen } from '@/components/auth-loading-screen';
import { useAppSession } from '@/components/providers/app-session-provider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { externalAuthId, loading, activeTenantId, me } = useAppSession();

  useEffect(() => {
    if (loading) return;
    if (!externalAuthId) {
      router.replace('/sign-in');
      return;
    }
    if (me && me.memberships.length > 1 && !activeTenantId) {
      router.replace('/select-org');
    }
  }, [loading, externalAuthId, activeTenantId, me, router]);

  if (loading || !externalAuthId) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
