'use client';

import Link from 'next/link';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { MARKETING_SCREENSHOTS, type MarketingScreenshotKey } from '@/lib/marketing-screenshots';

const steps: Array<{
  step: string;
  title: string;
  body: string;
  accent: string;
  screenshot: MarketingScreenshotKey;
  screenshotTitle: string;
  guideHref: string;
  guideLabel: string;
}> = [
  {
    step: '01',
    title: 'Connect your stack',
    body: 'OAuth into Salesforce, Jira, Slack, and Google Calendar. Field mappings and project links are guided in the setup wizard.',
    accent: 'bg-teal-500',
    screenshot: 'integrations',
    screenshotTitle: 'Connections',
    guideHref: '/docs?guide=connect-stack&step=0',
    guideLabel: 'Open setup walkthrough',
  },
  {
    step: '02',
    title: 'Beacon watches every signal',
    body: 'The risk engine continuously evaluates milestones, customer activity, revenue exposure, and cross-tool patterns.',
    accent: 'bg-cyan-500',
    screenshot: 'dashboard',
    screenshotTitle: 'Portfolio dashboard',
    guideHref: '/docs?guide=try-prototype&step=1',
    guideLabel: 'See the dashboard guide',
  },
  {
    step: '03',
    title: 'Act before revenue slips',
    body: 'Portfolio dashboards, predicted delays, root-cause explanations, and recommended actions land in one workspace.',
    accent: 'bg-emerald-500',
    screenshot: 'project',
    screenshotTitle: 'Project intelligence',
    guideHref: '/docs?guide=triage-risk&step=0',
    guideLabel: 'Learn to triage risks',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">How it works</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            From connected tools to leadership clarity in three steps
          </h2>
          <p className="mt-4 max-w-2xl text-slate-600">
            Each step links to a guided walkthrough on the docs page — one click from marketing to
            doing the thing in the app.
          </p>
        </ScrollReveal>

        <div className="relative mt-14">
          <div
            className="absolute left-6 top-8 hidden h-[calc(100%-4rem)] w-px bg-gradient-to-b from-teal-300 via-teal-200 to-transparent lg:left-1/2 lg:block"
            aria-hidden
          />
          <div className="space-y-14">
            {steps.map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 0.1}>
                <div
                  className={`relative grid gap-8 lg:grid-cols-2 lg:gap-16 ${
                    index % 2 === 1 ? 'lg:[&>div:first-child]:order-2' : ''
                  }`}
                >
                  <div className="flex items-start gap-4 lg:justify-end lg:text-right">
                    <span
                      className={`marketing-pulse-dot relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white ${item.accent}`}
                    >
                      {item.step}
                    </span>
                    <div className="lg:max-w-md">
                      <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.body}</p>
                      <Link
                        href={item.guideHref}
                        className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-800"
                      >
                        {item.guideLabel} →
                      </Link>
                    </div>
                  </div>
                  <div className="min-w-0">
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
