'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, Clock, ExternalLink } from 'lucide-react';
import { MarketingPageHero } from '@/components/marketing/marketing-page-hero';
import { MarketingSection } from '@/components/marketing/marketing-section';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import {
  DOC_REFERENCE_SECTIONS,
  DOC_WALKTHROUGHS,
  getWalkthrough,
  screenshotSrc,
  type DocsWalkthrough,
} from '@/lib/docs-walkthroughs';
import { cn } from '@/lib/utils';

function WalkthroughPicker({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {DOC_WALKTHROUGHS.map((guide) => (
        <button
          key={guide.id}
          type="button"
          onClick={() => onSelect(guide.id)}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-teal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-900">{guide.title}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              <Clock className="h-3 w-3" aria-hidden />
              {guide.duration}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{guide.description}</p>
          <p className="mt-3 text-xs font-medium text-teal-700">
            {guide.steps.length} steps · Start guide
          </p>
        </button>
      ))}
    </div>
  );
}

function WalkthroughViewer({
  guide,
  stepIndex,
  onStepChange,
  onExit,
}: {
  guide: DocsWalkthrough;
  stepIndex: number;
  onStepChange: (index: number) => void;
  onExit: () => void;
}) {
  const step = guide.steps[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === guide.steps.length - 1;
  const progress = Math.round(((stepIndex + 1) / guide.steps.length) * 100);

  return (
    <div className="space-y-6" id="walkthrough-viewer">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-teal-800"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          All guides
        </button>
        <span className="text-slate-300" aria-hidden>
          /
        </span>
        <span className="font-medium text-slate-900">{guide.title}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden space-y-4 lg:block">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Step {stepIndex + 1} of {guide.steps.length}
            </p>
          </div>

          <ol className="space-y-1">
            {guide.steps.map((item, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onStepChange(index)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
                      current
                        ? 'bg-teal-50 font-medium text-teal-900'
                        : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                        done
                          ? 'bg-teal-600 text-white'
                          : current
                            ? 'border border-teal-400 text-teal-700'
                            : 'border border-slate-200 text-slate-400',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
                    </span>
                    <span>{item.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <article className="min-w-0 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 lg:hidden">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
              <span>
                Step {stepIndex + 1} of {guide.steps.length}
              </span>
              <span>{progress}%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{step.title}</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">{step.body}</p>
          </div>

          {step.code ? (
            <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
              {step.code}
            </pre>
          ) : null}

          {step.screenshot ? (
            <ScreenshotFrame
              src={screenshotSrc(step.screenshot)}
              alt={step.screenshotAlt ?? step.title}
              title={step.screenshotTitle ?? 'Beacon'}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
            {!isFirst ? (
              <button type="button" onClick={() => onStepChange(stepIndex - 1)} className="marketing-btn-secondary">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Back
              </button>
            ) : null}
            {step.action ? (
              <Link href={step.action.href} className="marketing-btn-primary inline-flex items-center">
                {step.action.label}
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            ) : null}
            {!isLast ? (
              <button
                type="button"
                onClick={() => onStepChange(stepIndex + 1)}
                className="marketing-btn-secondary ml-auto inline-flex items-center"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button type="button" onClick={onExit} className="marketing-btn-secondary ml-auto">
                Done — pick another guide
              </button>
            )}
          </div>

          {isLast ? (
            <p className="rounded-lg border border-teal-100 bg-teal-50/80 px-4 py-3 text-sm text-teal-900">
              <span className="font-medium">Outcome:</span> {guide.outcome}
            </p>
          ) : null}
        </article>
      </div>
    </div>
  );
}

export function DocsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const guideId = searchParams.get('guide');
  const stepParam = searchParams.get('step');
  const guide = getWalkthrough(guideId);
  const stepIndex = useMemo(() => {
    const parsed = stepParam ? Number.parseInt(stepParam, 10) : 0;
    if (!guide || Number.isNaN(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), guide.steps.length - 1);
  }, [guide, stepParam]);

  const setWalkthrough = useCallback(
    (id: string | null, step = 0) => {
      if (!id) {
        router.push('/docs', { scroll: false });
        return;
      }
      router.push(`/docs?guide=${id}&step=${step}`, { scroll: false });
      requestAnimationFrame(() => {
        document.getElementById('walkthrough-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [router],
  );

  useEffect(() => {
    if (!guide) return;
    const guideId = guide.id;
    const stepCount = guide.steps.length;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' && stepIndex < stepCount - 1) {
        setWalkthrough(guideId, stepIndex + 1);
      }
      if (event.key === 'ArrowLeft' && stepIndex > 0) {
        setWalkthrough(guideId, stepIndex - 1);
      }
      if (event.key === 'Escape') {
        setWalkthrough(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [guide, setWalkthrough, stepIndex]);

  return (
    <main>
      <MarketingPageHero
        title="Documentation"
        description="Pick a guided walkthrough to go from zero to triaging risk — or jump to a reference section below."
      />

      <MarketingSection className="py-12" id="walkthrough-top">
        <div className="mb-10 flex items-center gap-2 text-sm font-medium text-slate-700">
          <BookOpen className="h-4 w-4 text-teal-700" aria-hidden />
          Guided walkthroughs
        </div>

        {guide ? (
          <>
            <WalkthroughViewer
              guide={guide}
              stepIndex={stepIndex}
              onStepChange={(index) => setWalkthrough(guide.id, index)}
              onExit={() => setWalkthrough(null)}
            />
            <p className="mt-3 text-xs text-slate-500">
              Tip: use ← → arrow keys to move between steps. Esc returns to all guides.
            </p>
          </>
        ) : (
          <WalkthroughPicker onSelect={(id) => setWalkthrough(id, 0)} />
        )}
      </MarketingSection>

      <MarketingSection variant="muted" className="py-16">
        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="space-y-1 text-sm" aria-label="Reference sections">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reference
              </p>
              {DOC_REFERENCE_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-slate-600 transition hover:bg-white hover:text-teal-800"
                >
                  {section.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="max-w-none space-y-16">
            <section id="getting-started" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold text-slate-900">Getting started</h2>
              <p className="mt-3 text-slate-600">{DOC_REFERENCE_SECTIONS[0].summary}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/docs?guide=try-prototype&step=0" className="marketing-btn-primary">
                  Try the prototype guide
                </Link>
                <Link href="/docs?guide=self-host&step=0" className="marketing-btn-secondary">
                  Self-host guide
                </Link>
              </div>
            </section>

            <section id="integrations" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold text-slate-900">Integrations</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                Connect Salesforce, Jira, Slack, and Google Calendar from{' '}
                <Link href="/integrations" className="font-medium text-teal-700 hover:text-teal-800">
                  Connections
                </Link>
                . Admins use the{' '}
                <Link href="/integrations/setup" className="font-medium text-teal-700 hover:text-teal-800">
                  setup wizard
                </Link>{' '}
                for the fastest path.
              </p>
              <div className="mt-6 max-w-3xl">
                <ScreenshotFrame
                  src={screenshotSrc('integrations')}
                  alt="Connections page showing Salesforce, Jira, Slack, and Calendar"
                  title="Connections"
                  compact
                />
              </div>
              <Link
                href="/docs?guide=connect-stack&step=0"
                className="marketing-btn-secondary mt-6 inline-flex"
              >
                Open connect-stack walkthrough
              </Link>
            </section>

            <section id="dashboard" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                Portfolio metrics, peer benchmarks (when opted in), filterable risk feed, and an
                executive print summary for leadership reviews.
              </p>
              <div className="mt-6 max-w-3xl">
                <ScreenshotFrame
                  src={screenshotSrc('dashboard')}
                  alt="Portfolio dashboard with metrics and at-risk projects"
                  title="Portfolio dashboard"
                  compact
                />
              </div>
              <Link
                href="/docs?guide=triage-risk&step=0"
                className="marketing-btn-secondary mt-6 inline-flex"
              >
                Open triage walkthrough
              </Link>
            </section>

            <section id="settings" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                Language, currency, appearance, notification preferences, custom risk rules, and
                outbound webhooks. Admins manage org-wide flags, benchmarks, and compliance from
                the Admin tab.
              </p>
              <Link href="/settings" className="mt-4 inline-flex font-medium text-teal-700 hover:text-teal-800">
                Open settings in the app
              </Link>
            </section>

            <section id="privacy" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold text-slate-900">Privacy</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                Export data, request deletion, and accept the DPA from Settings. See{' '}
                <Link href="/security" className="font-medium text-teal-700 hover:text-teal-800">
                  Security
                </Link>{' '}
                and the{' '}
                <Link href="/legal/dpa" className="font-medium text-teal-700 hover:text-teal-800">
                  DPA
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </MarketingSection>
    </main>
  );
}
