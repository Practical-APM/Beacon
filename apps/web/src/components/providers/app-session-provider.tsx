'use client';

import type { MeResponse, TenantMembershipSummary } from '@beacon/shared/auth';
import { useAuth } from '@clerk/nextjs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { buildApiHeaders } from '@/lib/api-auth';

const SESSION_KEY = 'beacon.dev.session';
const TENANT_KEY = 'beacon.activeTenantId';

interface DevSession {
  externalAuthId: string;
  activeTenantId: string | null;
}

export interface AppSessionContextValue {
  authDevMode: boolean;
  externalAuthId: string | null;
  activeTenantId: string | null;
  me: MeResponse | null;
  loading: boolean;
  signIn: (externalAuthId: string) => Promise<void>;
  signOut: () => void;
  setActiveTenantId: (tenantId: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  getAuthHeaders: (tenantId?: string | null) => Promise<Record<string, string>>;
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

function readDevSession(): DevSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DevSession;
  } catch {
    return null;
  }
}

function writeDevSession(session: DevSession | null) {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TENANT_KEY);
}

function writeStoredTenantId(tenantId: string | null) {
  if (typeof window === 'undefined') return;
  if (!tenantId) {
    window.localStorage.removeItem(TENANT_KEY);
    return;
  }
  window.localStorage.setItem(TENANT_KEY, tenantId);
}

async function fetchMe(
  headers: Record<string, string>,
): Promise<MeResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/v1/me`, { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to load session');
  }
  return res.json() as Promise<MeResponse>;
}

function resolveActiveTenant(
  profile: MeResponse,
  preferredTenantId: string | null,
): string | null {
  if (
    preferredTenantId &&
    profile.memberships.some((membership) => membership.tenantId === preferredTenantId)
  ) {
    return preferredTenantId;
  }
  if (profile.memberships.length === 1) {
    return profile.memberships[0]?.tenantId ?? null;
  }
  return preferredTenantId;
}

function DevAppSessionProvider({ children }: { children: ReactNode }) {
  const [externalAuthId, setExternalAuthId] = useState<string | null>(null);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = useCallback(
    async (tenantId?: string | null) =>
      buildApiHeaders({
        authDevMode: true,
        externalAuthId: externalAuthId ?? '',
        activeTenantId: tenantId ?? activeTenantId,
        getClerkToken: async () => null,
      }),
    [externalAuthId, activeTenantId],
  );

  const refreshMe = useCallback(async () => {
    if (!externalAuthId) {
      setMe(null);
      return;
    }
    const headers = await getAuthHeaders(activeTenantId);
    const profile = await fetchMe(headers);
    setMe(profile);
    const resolvedTenant = resolveActiveTenant(profile, activeTenantId);
    if (resolvedTenant !== activeTenantId) {
      setActiveTenantIdState(resolvedTenant);
      writeDevSession({ externalAuthId, activeTenantId: resolvedTenant });
      writeStoredTenantId(resolvedTenant);
    }
  }, [externalAuthId, activeTenantId, getAuthHeaders]);

  useEffect(() => {
    const session = readDevSession();
    const storedTenant = readStoredTenantId();
    if (session?.externalAuthId) {
      setExternalAuthId(session.externalAuthId);
      setActiveTenantIdState(session.activeTenantId ?? storedTenant);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!externalAuthId) {
      setMe(null);
      return;
    }
    void refreshMe().catch(() => {
      setMe(null);
      setExternalAuthId(null);
      writeDevSession(null);
    });
  }, [externalAuthId, activeTenantId, refreshMe]);

  const signIn = useCallback(async (nextExternalAuthId: string) => {
    const headers = await buildApiHeaders({
      authDevMode: true,
      externalAuthId: nextExternalAuthId,
      getClerkToken: async () => null,
    });
    const profile = await fetchMe(headers);
    const nextTenantId = resolveActiveTenant(profile, readStoredTenantId());
    setExternalAuthId(nextExternalAuthId);
    setActiveTenantIdState(nextTenantId);
    writeDevSession({ externalAuthId: nextExternalAuthId, activeTenantId: nextTenantId });
    writeStoredTenantId(nextTenantId);
    setMe(profile);
  }, []);

  const signOut = useCallback(() => {
    setExternalAuthId(null);
    setActiveTenantIdState(null);
    setMe(null);
    writeDevSession(null);
    writeStoredTenantId(null);
  }, []);

  const setActiveTenantId = useCallback(
    async (tenantId: string) => {
      if (!externalAuthId) return;
      setActiveTenantIdState(tenantId);
      writeDevSession({ externalAuthId, activeTenantId: tenantId });
      writeStoredTenantId(tenantId);
      const headers = await getAuthHeaders(tenantId);
      const profile = await fetchMe(headers);
      setMe(profile);
    },
    [externalAuthId, getAuthHeaders],
  );

  const value = useMemo(
    () => ({
      authDevMode: true,
      externalAuthId,
      activeTenantId,
      me,
      loading,
      signIn,
      signOut,
      setActiveTenantId,
      refreshMe,
      getAuthHeaders,
    }),
    [
      externalAuthId,
      activeTenantId,
      me,
      loading,
      signIn,
      signOut,
      setActiveTenantId,
      refreshMe,
      getAuthHeaders,
    ],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

function ClerkAppSessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut: clerkSignOut } = useAuth();
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const getClerkToken = useCallback(async () => getToken(), [getToken]);

  const getAuthHeaders = useCallback(
    async (tenantId?: string | null) => {
      if (!userId) {
        throw new Error('Missing Clerk session');
      }
      return buildApiHeaders({
        authDevMode: false,
        externalAuthId: userId,
        activeTenantId: tenantId ?? activeTenantId,
        getClerkToken,
      });
    },
    [userId, activeTenantId, getClerkToken],
  );

  const refreshMe = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setMe(null);
      return;
    }
    const headers = await getAuthHeaders(activeTenantId);
    const profile = await fetchMe(headers);
    setMe(profile);
    const resolvedTenant = resolveActiveTenant(profile, activeTenantId ?? readStoredTenantId());
    if (resolvedTenant !== activeTenantId) {
      setActiveTenantIdState(resolvedTenant);
      writeStoredTenantId(resolvedTenant);
    }
  }, [isSignedIn, userId, activeTenantId, getAuthHeaders]);

  useEffect(() => {
    if (!isLoaded) return;
    setActiveTenantIdState(readStoredTenantId());
    setLoading(false);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !userId) {
      setMe(null);
      return;
    }
    void refreshMe().catch(() => setMe(null));
  }, [isLoaded, isSignedIn, userId, activeTenantId, refreshMe]);

  const signIn = useCallback(async () => {
    throw new Error('Use Clerk sign-in');
  }, []);

  const signOut = useCallback(() => {
    setMe(null);
    setActiveTenantIdState(null);
    writeStoredTenantId(null);
    void clerkSignOut();
  }, [clerkSignOut]);

  const setActiveTenantId = useCallback(
    async (tenantId: string) => {
      if (!userId) return;
      setActiveTenantIdState(tenantId);
      writeStoredTenantId(tenantId);
      const headers = await getAuthHeaders(tenantId);
      const profile = await fetchMe(headers);
      setMe(profile);
    },
    [userId, getAuthHeaders],
  );

  const value = useMemo(
    () => ({
      authDevMode: false,
      externalAuthId: isSignedIn ? userId : null,
      activeTenantId,
      me,
      loading: !isLoaded || loading,
      signIn,
      signOut,
      setActiveTenantId,
      refreshMe,
      getAuthHeaders,
    }),
    [
      isSignedIn,
      userId,
      activeTenantId,
      me,
      isLoaded,
      loading,
      signIn,
      signOut,
      setActiveTenantId,
      refreshMe,
      getAuthHeaders,
    ],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function AppSessionProvider({
  children,
  authDevMode,
}: {
  children: ReactNode;
  authDevMode: boolean;
}) {
  if (authDevMode) {
    return <DevAppSessionProvider>{children}</DevAppSessionProvider>;
  }
  return <ClerkAppSessionProvider>{children}</ClerkAppSessionProvider>;
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error('useAppSession must be used within AppSessionProvider');
  }
  return context;
}

export function useActiveMembership(): TenantMembershipSummary | null {
  const { me, activeTenantId } = useAppSession();
  return me?.memberships.find((membership) => membership.tenantId === activeTenantId) ?? null;
}
