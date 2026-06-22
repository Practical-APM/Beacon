'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAppSession } from '@/components/providers/app-session-provider';

const DISMISS_KEY = 'beacon.session-banner.dismissed';

export function SessionBanner() {
  const { externalAuthId, loading } = useAppSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading || !externalAuthId) return;
    const dismissed = window.sessionStorage.getItem(DISMISS_KEY) === '1';
    setVisible(!dismissed);
  }, [externalAuthId, loading]);

  if (!visible) return null;

  return (
    <div className="border-b border-teal-200 bg-teal-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <p className="text-sm text-teal-900">You are signed in. Jump back into your workspace.</p>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
          >
            Open dashboard
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-teal-700 transition hover:bg-teal-100"
            aria-label="Dismiss signed-in banner"
            onClick={() => {
              window.sessionStorage.setItem(DISMISS_KEY, '1');
              setVisible(false);
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
