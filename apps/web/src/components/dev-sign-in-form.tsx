'use client';

import Link from 'next/link';
import { useAppSession } from '@/components/providers/app-session-provider';
import { FeedbackBanner } from '@/components/feedback-banner';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const DEV_USERS = [
  {
    id: 'admin-a',
    label: 'Acme Admin',
    org: 'Acme Corp',
    role: 'admin',
    description: 'Full access — connect integrations, acknowledge risks, and manage settings.',
  },
  {
    id: 'contributor-a',
    label: 'Acme Contributor',
    org: 'Acme Corp',
    role: 'contributor',
    description: 'View-only — see portfolio and project risks but cannot connect or acknowledge.',
  },
  {
    id: 'admin-b',
    label: 'Globex Admin',
    org: 'Globex',
    role: 'admin',
    description: 'Separate tenant to test multi-org switching and isolated demo data.',
  },
] as const;

const DEFAULT_USER = DEV_USERS[0]?.id ?? 'admin-a';

export function DevSignInForm() {
  const { signIn } = useAppSession();
  const [selected, setSelected] = useState<string>(DEFAULT_USER);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedUser = DEV_USERS.find((user) => user.id === selected) ?? DEV_USERS[0];

  async function enterWorkspace(userId = selected) {
    setLoading(true);
    setError(null);
    try {
      await signIn(userId);
      window.location.href = '/dashboard';
    } catch {
      setError('Sign in failed. Ensure API and database are running, then run make db-seed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="settings-section space-y-4">
      <div>
        <h2 className="settings-section-title">Enter the demo workspace</h2>
        <p className="settings-section-lead">
          One click to explore portfolio risk, project intelligence, and settings with seeded demo
          data.
        </p>
      </div>

      <button
        type="button"
        disabled={loading}
        className="btn-primary w-full py-3 text-base"
        onClick={() => void enterWorkspace(DEFAULT_USER)}
      >
        {loading ? 'Opening workspace…' : 'Enter demo workspace'}
      </button>

      <button
        type="button"
        className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => setShowAdvanced((value) => !value)}
      >
        {showAdvanced ? 'Hide advanced options' : 'Choose a different demo user'}
      </button>

      {showAdvanced ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void enterWorkspace(selected);
          }}
          className="space-y-3 border-t border-border pt-4"
        >
          <label className="flex flex-col gap-2">
            <span className="form-label">Demo user</span>
            <select
              className={cn('form-input')}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {DEV_USERS.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label} ({user.role}) · {user.org}
                </option>
              ))}
            </select>
          </label>
          {selectedUser ? (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {selectedUser.description}
            </p>
          ) : null}
          <button type="submit" disabled={loading} className="btn-secondary w-full">
            Continue as selected user
          </button>
        </form>
      ) : null}

      {error ? <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} /> : null}
      <p className="text-xs text-muted-foreground">
        Requires <code className="rounded bg-muted px-1 py-0.5">make dev</code> and{' '}
        <code className="rounded bg-muted px-1 py-0.5">make db-seed</code>.{' '}
        <Link href="/docs?guide=try-prototype&step=0" className="font-medium text-primary hover:underline">
          Follow the prototype guide
        </Link>
      </p>
    </div>
  );
}
