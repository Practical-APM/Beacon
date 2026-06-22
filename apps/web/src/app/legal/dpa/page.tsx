'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AppPageHeader } from '@/components/app-page-header';
import { FeedbackBanner } from '@/components/feedback-banner';
import { RequireAuth } from '@/components/require-auth';
import { useAppSession } from '@/components/providers/app-session-provider';
import { useApiClient } from '@/lib/use-api-client';
import { CheckCircle2, FileText } from 'lucide-react';

interface DpaDocument {
  version: string;
  title: string;
  effectiveDate: string;
  sections: Array<{ heading: string; body: string }>;
}

export default function DpaPage() {
  const { me, refreshMe } = useAppSession();
  const { apiFetch, ready } = useApiClient();
  const [document, setDocument] = useState<DpaDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const loadDocument = useCallback(async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/legal/dpa`);
    if (!res.ok) throw new Error('Failed to load DPA');
    const body = (await res.json()) as { document: DpaDocument };
    setDocument(body.document);
  }, []);

  useEffect(() => {
    void loadDocument()
      .catch((err) => setError(err instanceof Error ? err.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [loadDocument]);

  async function acceptDpa() {
    if (!ready) {
      setError('Sign in and select an organization to accept the DPA.');
      return;
    }

    setAccepting(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/legal/dpa/accept', { method: 'POST' });
      await refreshMe();
      setMessage('DPA accepted. Thank you.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acceptance failed');
    } finally {
      setAccepting(false);
    }
  }

  const dpaCurrent = me?.user.dpaCurrent ?? false;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-6 pb-24">
          <AppPageHeader
            title="Data Processing Agreement"
            description={
              document
                ? `Version ${document.version} · Effective ${document.effectiveDate}`
                : loading
                  ? 'Loading agreement…'
                  : 'Review before connecting production integrations'
            }
          >
            <Link href="/settings?tab=account" className="btn-secondary">
              ← Settings
            </Link>
          </AppPageHeader>

          {message ? (
            <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
          ) : null}
          {error ? (
            <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
          ) : null}

          {loading ? (
            <div className="animate-pulse space-y-4" aria-busy="true">
              <div className="h-48 rounded-xl border border-border bg-card" />
              <div className="h-32 rounded-xl border border-border bg-card" />
            </div>
          ) : document ? (
            <>
              {document.sections.length > 1 ? (
                <nav
                  className="flex flex-wrap gap-2"
                  aria-label="DPA sections"
                >
                  {document.sections.map((section) => (
                    <a
                      key={section.heading}
                      href={`#${section.heading.toLowerCase().replace(/\s+/g, '-')}`}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                    >
                      {section.heading}
                    </a>
                  ))}
                </nav>
              ) : null}

              <article className="settings-section space-y-8">
                <div className="flex items-start gap-3 border-b border-border pb-6">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="font-medium">{document.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Required for organizations connecting customer data in production.
                    </p>
                  </div>
                </div>
                {document.sections.map((section) => (
                  <section
                    key={section.heading}
                    id={section.heading.toLowerCase().replace(/\s+/g, '-')}
                    className="scroll-mt-24"
                  >
                    <h2 className="text-base font-semibold">{section.heading}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {section.body}
                    </p>
                  </section>
                ))}
              </article>
            </>
          ) : null}

          <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:bottom-0 lg:pl-[calc(18rem+1.25rem)]">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
              {dpaCurrent ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  You have accepted the current DPA.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Accept to proceed with production integrations.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {!dpaCurrent ? (
                  <button
                    type="button"
                    disabled={accepting || !document}
                    onClick={() => void acceptDpa()}
                    className="btn-primary"
                  >
                    {accepting ? 'Recording acceptance…' : 'Accept DPA'}
                  </button>
                ) : null}
                <Link href="/settings?tab=account" className="btn-secondary">
                  Back to settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
