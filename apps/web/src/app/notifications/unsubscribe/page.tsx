'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, MailX, XCircle } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  daily_digest: 'daily digest emails',
  immediate_alert: 'immediate risk alerts',
  weekly_digest: 'weekly digest emails',
};

function UnsubscribeContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const type = params.get('type') ?? 'daily_digest';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('This unsubscribe link is missing a token.');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    void fetch(
      `${apiUrl}/v1/notifications/unsubscribe?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`,
    )
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          return;
        }
        const text = await res.text().catch(() => '');
        setStatus('error');
        setErrorMessage(text || 'This unsubscribe link is invalid or has expired.');
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('Unable to reach the server. Try again later.');
      });
  }, [token, type]);

  const typeLabel = TYPE_LABELS[type] ?? type.replace(/_/g, ' ');

  if (status === 'loading') {
    return (
      <div className="settings-section animate-pulse space-y-3" aria-busy="true">
        <div className="mx-auto h-10 w-10 rounded-full bg-muted" />
        <div className="mx-auto h-4 w-48 rounded bg-muted" />
        <div className="h-3 rounded bg-muted" />
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="settings-section text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold">You are unsubscribed</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You will no longer receive {typeLabel} from Beacon.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Changed your mind? Update preferences in{' '}
          <Link href="/settings?tab=notifications" className="text-primary hover:underline">
            Settings → Notifications
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="settings-section text-center">
      <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold">Unable to unsubscribe</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {errorMessage ?? 'Something went wrong.'}
      </p>
      <Link href="/settings?tab=notifications" className="btn-secondary mt-6 inline-flex">
        Open notification settings
      </Link>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-2.5 px-6">
          <Image
            src="/marketing/logo-mark.svg"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
            aria-hidden
          />
          <span className="text-sm font-semibold">Beacon</span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 py-16">
        <div className="mb-8 text-center">
          <MailX className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Email preferences</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your Beacon notification subscriptions.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="settings-section animate-pulse h-32" aria-busy="true" />
          }
        >
          <UnsubscribeContent />
        </Suspense>
      </div>
    </main>
  );
}
