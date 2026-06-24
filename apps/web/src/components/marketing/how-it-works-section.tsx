'use client';

import Link from 'next/link';
import { ArrowRight, Eye, Link2, Zap, type LucideIcon } from 'lucide-react';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { MarketingIcon } from '@/components/marketing/marketing-icon';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { MARKETING_SCREENSHOTS, type MarketingScreenshotKey } from '@/lib/marketing-screenshots';

const steps: Array<{
  step: string;
  title: string;
  body: string;
  accentClass: string;
  accentBg: string;
  accentText: string;
  screenshot: MarketingScreenshotKey;
  screenshotTitle: string;
  guideHref: string;
  guideLabel: string;
  icon: LucideIcon;
}> = [
  {
    step: '01',
    title: 'Connect your stack',
    body: 'OAuth into Salesforce, Jira, Slack, and Google Calendar. Field mappings and project links are guided in the setup wizard.',
    accentClass: 'bg-teal-600',
    accentBg: 'bg-[var(--m-accent-soft)] border-[var(--m-border)]',
    accentText: 'text-[var(--m-accent)]',
    icon: Link2,
    screenshot: 'integrations',
    screenshotTitle: 'Connections',
    guideHref: '/docs?guide=connect-stack&step=0',
    guideLabel: 'Open setup walkthrough',
  },
  {
    step: '02',
    title: 'Beacon watches every signal',
    body: 'The risk engine continuously evaluates milestones, customer activity, revenue exposure, and cross-tool patterns.',
    accentClass: 'bg-cyan-600',
    accentBg: 'bg-[var(--m-accent-soft)] border-[var(--m-border)]',
    accentText: 'text-[var(--m-accent)]',
    icon: Eye,
    screenshot: 'dashboard',
    screenshotTitle: 'Portfolio dashboard',
    guideHref: '/docs?guide=try-prototype&step=1',
    guideLabel: 'See the dashboard guide',
  },
  {
    step: '03',
    title: 'Act before revenue slips',
    body: 'Portfolio dashboards, predicted delays, root-cause explanations, and recommended actions land in one workspace.',
    accentClass: 'bg-emerald-600',
    accentBg: 'bg-[var(--m-accent-soft)] border-[var(--m-border)]',
    accentText: 'text-[var(--m-accent)]',
    icon: Zap,
    screenshot: 'project',
    screenshotTitle: 'Project intelligence',
    guideHref: '/docs?guide=triage-risk&step=0',
    guideLabel: 'Learn to triage risks',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-24 overflow-hidden py-24 sm:py-32 marketing-section-divider">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="marketing-section-label">
            <span className="marketing-section-index">§ 04</span>
            <span>How it works</span>
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-[var(--m-text)] sm:text-4xl">
            From connected tools to leadership clarity in three steps
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--m-muted)]">
            Each step links to a guided walkthrough on the docs page — one click from marketing to
            doing the thing in the app.
          </p>
        </ScrollReveal>

        <div className="relative mt-16">
          <div
            className="absolute left-[27px] top-10 hidden h-[calc(100%-6rem)] w-0.5 bg-gradient-to-b from-teal-500/50 via-cyan-500/30 to-transparent lg:left-1/2 lg:block"
            aria-hidden
          />

          <div className="space-y-16 sm:space-y-20">
            {steps.map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 0.08}>
                <div
                  className={`relative grid items-center gap-10 lg:grid-cols-2 lg:gap-20 ${
                    index % 2 === 1 ? 'lg:[&>div:first-child]:order-2' : ''
                  }`}
                >
                  <div className="flex items-start gap-5">
                    <div className="flex flex-col items-center">
                      <span
                        className={`marketing-step-badge marketing-pulse-dot relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${item.accentClass} shadow-lg`}
                      >
                        <MarketingIcon icon={item.icon} className="text-white" />
                      </span>
                      <span className="mt-2 text-xs font-bold tracking-wider text-[var(--m-muted)]">
                        {item.step}
                      </span>
                    </div>

                    <div className="max-w-md pt-2 lg:max-w-none">
                      <h3 className="font-display text-xl font-bold text-[var(--m-text)]">{item.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-[var(--m-muted)]">{item.body}</p>
                      <Link
                        href={item.guideHref}
                        className={`mt-5 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold ${item.accentBg} ${item.accentText} transition-all hover:gap-2.5`}
                      >
                        {item.guideLabel}
                        <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                      </Link>
                    </div>
                  </div>

                  <div className="min-w-0 transition-transform duration-500 hover:scale-[1.01] hover:-translate-y-1">
                    <ScreenshotFrame
                      src={MARKETING_SCREENSHOTS[item.screenshot]}
                      alt={item.title}
                      title={item.screenshotTitle}
                      compact
                    />
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
