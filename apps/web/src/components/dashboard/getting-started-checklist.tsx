'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import {
  dismissGettingStarted,
  hasViewedProjectForChecklist,
  isGettingStartedDismissed,
} from '@/lib/getting-started';
import { cn } from '@/lib/utils';
import type { RiskFeedItem } from '@/components/dashboard/risk-card';

type GettingStartedChecklistProps = {
  setupComplete: boolean;
  risks: RiskFeedItem[];
  atRiskCount: number;
};

export function GettingStartedChecklist({
  setupComplete,
  risks,
  atRiskCount,
}: GettingStartedChecklistProps) {
  const [visible, setVisible] = useState(false);
  const [viewedProject, setViewedProject] = useState(false);

  useEffect(() => {
    setViewedProject(hasViewedProjectForChecklist());
    setVisible(!isGettingStartedDismissed());
  }, []);

  const firstProjectId = risks.find((risk) => risk.projectId)?.projectId;
  const firstProjectHref = firstProjectId ? `/projects/${firstProjectId}` : '/dashboard';

  const steps = useMemo(
    () => [
      {
        id: 'connect',
        label: 'Connect your stack',
        detail: setupComplete
          ? 'Core integrations are ready'
          : 'Start with Salesforce, then add Jira and Slack for full coverage',
        href: '/integrations/setup',
        done: setupComplete,
      },
      {
        id: 'review',
        label: 'Review at-risk projects',
        detail:
          atRiskCount > 0
            ? `${atRiskCount} project${atRiskCount === 1 ? '' : 's'} need attention`
            : 'Scan the portfolio risk feed below',
        href: '#risk-feed-heading',
        done: risks.length > 0 || atRiskCount > 0,
      },
      {
        id: 'act',
        label: 'Investigate a project',
        detail: 'See predicted delays, root causes, and actions',
        href: firstProjectHref,
        done: viewedProject,
      },
    ],
    [atRiskCount, firstProjectHref, risks.length, setupComplete, viewedProject],
  );

  const completedCount = steps.filter((step) => step.done).length;
  const allDone = completedCount === steps.length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  useEffect(() => {
    if (allDone && visible) {
      dismissGettingStarted();
      setVisible(false);
    }
  }, [allDone, visible]);

  if (!visible) return null;

  return (
    <section className="settings-section overflow-hidden p-0">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Getting started</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Three steps to value. {completedCount} of {steps.length} complete.
          </p>
          <Link
            href="/docs?guide=try-prototype&step=0"
            className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
          >
            View guided walkthrough
          </Link>
          <div
            className="mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Getting started progress"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Dismiss getting started checklist"
          onClick={() => {
            dismissGettingStarted();
            setVisible(false);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <ol className="divide-y divide-border">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                'flex items-center gap-4 px-5 py-4 transition-colors sm:px-6',
                step.done ? 'bg-primary/5' : 'hover:bg-accent/40',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                  step.done
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground',
                )}
              >
                {step.done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{step.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{step.detail}</span>
              </span>
              {!step.done ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
