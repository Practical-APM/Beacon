'use client';

import Link from 'next/link';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { MarketingSection, MarketingSectionHeader } from '@/components/marketing/marketing-section';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

type BentoCell = {
  span: string;
  title: string;
  body: string;
  callout?: string;
  screenshot?: string;
  screenshotTitle?: string;
  large?: boolean;
  wide?: boolean;
};

const cells: BentoCell[] = [
  {
    span: 'lg:col-span-2 lg:row-span-2',
    title: 'Portfolio command center',
    body: 'Every active implementation, revenue delayed, and project needing attention in one view.',
    screenshot: MARKETING_SCREENSHOTS.dashboard,
    screenshotTitle: 'Portfolio dashboard',
    large: true,
  },
  {
    span: '',
    title: 'Predicted delays',
    body: '80% confidence intervals on go-live slip, not black-box guesses.',
    callout: 'Point estimate plus low/high bounds',
  },
  {
    span: '',
    title: 'Root-cause intelligence',
    body: 'AI explanations backed by Jira, Slack, and CRM evidence.',
    callout: 'Every insight links to source signals',
  },
  {
    span: 'lg:col-span-2',
    title: 'Connect in minutes',
    body: 'OAuth into Salesforce, Jira, Slack, and Calendar. No rip-and-replace.',
    screenshot: MARKETING_SCREENSHOTS.integrations,
    screenshotTitle: 'Connections',
    wide: true,
  },
  {
    span: '',
    title: 'Project deep dive',
    body: 'Delay predictions, risks, timeline, and recommended actions per customer.',
    screenshot: MARKETING_SCREENSHOTS.project,
    screenshotTitle: 'Project intelligence',
  },
];

export function BentoFeaturesSection() {
  return (
    <MarketingSection id="features" variant="muted">
      <MarketingSectionHeader
        eyebrow="Platform"
        title="Everything leadership needs, without another status meeting"
        description="A bento-style workspace built for implementation-heavy B2B teams. Scan the portfolio, drill into projects, act before revenue slips."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto]">
        {cells.map((cell, index) => (
          <ScrollReveal key={cell.title} delay={index * 0.05} className={cell.span}>
            <article
              className={`marketing-bento-cell group h-full ${cell.large ? 'marketing-bento-large' : ''} ${cell.wide ? 'marketing-bento-wide' : ''}`}
            >
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-slate-900">{cell.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{cell.body}</p>
                {cell.callout ? (
                  <p className="mt-5 inline-flex rounded-lg border border-teal-100 bg-teal-50/80 px-3 py-2 text-xs font-medium text-teal-800">
                    {cell.callout}
                  </p>
                ) : null}
              </div>
              {cell.screenshot ? (
                <div className="relative z-0 mt-6">
                  <ScreenshotFrame
                    src={cell.screenshot}
                    alt={cell.screenshotTitle ?? cell.title}
                    title={cell.screenshotTitle}
                    compact
                    className={cell.wide ? 'marketing-bento-screenshot-wide' : undefined}
                  />
                </div>
              ) : null}
            </article>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal className="mt-10 text-center" delay={0.2}>
        <Link href="/sign-in" className="marketing-btn-primary">
          See it with demo data
        </Link>
      </ScrollReveal>
    </MarketingSection>
  );
}
