'use client';

import { connectIntegration, fetchIntegrationConnectAvailability } from '@/lib/integration-connect';
import type { IntegrationConnectSource } from '@/lib/integration-connect';
import { bootstrapAfterConnect } from '@/lib/setup-orchestrator';
import { useAppSession } from '@/components/providers/app-session-provider';
import { useEffect, useState } from 'react';

type ConnectAvailability = {
  available: boolean;
  mockMode: boolean;
  message?: string;
};

export function IntegrationConnectPanel({
  apiFetch,
  isAdmin,
  connected,
  connectPath,
  connectSource,
  integrationName,
  onMessage,
  onError,
  onConnected,
  mockHelpText,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<unknown>;
  isAdmin: boolean;
  connected: boolean;
  connectPath: string;
  connectSource: IntegrationConnectSource;
  integrationName: string;
  onMessage: (message: string | null) => void;
  onError: (error: string | null) => void;
  onConnected: () => Promise<void>;
  mockHelpText: string;
}) {
  const { authDevMode } = useAppSession();
  const [connectAvailability, setConnectAvailability] = useState<ConnectAvailability | null>(null);

  useEffect(() => {
    if (!isAdmin || connected) return;
    void fetchIntegrationConnectAvailability(apiFetch, connectPath)
      .then(setConnectAvailability)
      .catch(() => setConnectAvailability({ available: false, mockMode: false }));
  }, [apiFetch, connected, connectPath, isAdmin]);

  async function connect() {
    onMessage(null);
    onError(null);
    try {
      const result = await connectIntegration(apiFetch, connectSource);
      if (result === 'mock-connected') {
        await bootstrapAfterConnect(apiFetch);
        onMessage(`${integrationName} connected. Projects linked automatically where possible.`);
      }
      await onConnected();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Connect failed');
    }
  }

  if (!isAdmin || connected) return null;

  return (
    <div className="mt-6">
      {connectAvailability?.available === false ? (
        <p className="text-sm text-muted-foreground">
          {connectAvailability.message ??
            `${integrationName} OAuth is not configured. Contact your administrator.`}
        </p>
      ) : (
        <>
          <button type="button" onClick={() => void connect()} className="btn-primary">
            {authDevMode && connectAvailability?.mockMode
              ? `Connect ${integrationName} (demo data)`
              : `Connect ${integrationName}`}
          </button>
          {authDevMode && connectAvailability?.mockMode ? (
            <p className="mt-2 text-xs text-muted-foreground">{mockHelpText}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
