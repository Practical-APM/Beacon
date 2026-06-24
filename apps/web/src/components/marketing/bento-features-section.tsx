'use client';

import Link from 'next/link';
import {
  BarChart3,
  Brain,
  ClipboardList,
  LayoutDashboard,
  Link2,
  Search,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { MarketingIcon, MarketingIconBadge } from '@/components/marketing/marketing-icon';
import { MarketingSection, MarketingSectionHeader } from '@/components/marketing/marketing-section';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

type BentoCell = {
  span: string;
  title: string;
  body: string;
  callout?: string;
  calloutIcon?: LucideIcon;
  screenshot?: string;
  screenshotTitle?: string;
  large?: boolean;
  wide?: boolean;
  accentColor?: string;
  icon: LucideIcon;
};

const cells: BentoCell[] = [
  {
    span: 'lg:col-span-2 lg:row-span-2',
    title: 'Portfolio command center',
    body: 'Every active implementation, revenue delayed, and project needing attention in one unified view.',
    screenshot: MARKETING_SCREENSHOTS.dashboard,
    screenshotTitle: 'Portfolio dashboard',
    large: true,
    accentColor: 'from-teal-500/10 to-cyan-500/5',
    icon: LayoutDashboard,
  },
  {
    span: '',
    title: 'Predicted delays',
    body: '80% confidence intervals on go-live slip, not black-box guesses.',
    callout: 'Point estimate + low/high bounds',
    calloutIcon: BarChart3,
    accentColor: 'from-amber-500/8 to-orange-500/5',
    icon: Timer,
  },
  {
    span: '',
    title: 'Root-cause intelligence',
    body: 'AI explanations backed by Jira, Slack, and CRM evidence.',
    callout: 'Every insight links to source signals',
    calloutIcon: Search,
    accentColor: 'from-violet-500/8 to-purple-500/5',
    icon: Brain,
  },
  {
    span: 'lg:col-span-2',
    title: 'Connect in minutes',
    body: 'OAuth into Salesforce, Jira, Slack, and Calendar. No rip-and-replace.',
    screenshot: MARKETING_SCREENSHOTS.integrations,
    screenshotTitle: 'Connections',
    wide: true,
    accentColor: 'from-blue-500/8 to-cyan-500/5',
    icon: Link2,
  },
  {
    span: '',
    title: 'Project deep dive',
    body: 'Delay predictions, risks, timeline, and recommended actions per customer.',
    screenshot: MARKETING_SCREENSHOTS.project,
    screenshotTitle: 'Project intelligence',
    accentColor: 'from-emerald-500/8 to-teal-500/5',
    icon: ClipboardList,
  },
];

export function BentoFeaturesSection() {
  return (
    <MarketingSection id="features" variant="muted" divider>
      <MarketingSectionHeader
        sectionIndex="02"
        eyebrow="Platform"
        title="Everything leadership needs, without another status meeting"
        description="A bento-style workspace built for implementation-heavy B2B teams. Scan the portfolio, drill into projects, act before revenue slips."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto]">
        {cells.map((cell, index) => (
          <ScrollReveal key={cell.title} delay={index * 0.06} className={cell.span}>
            <article
              className={`marketing-bento-cell group h-full ${cell.large ? 'marketing-bento-large' : ''} ${cell.wide ? 'marketing-bento-wide' : ''}`}
            >
              {cell.accentColor ? (
                <div
                  className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${cell.accentColor} opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                  aria-hidden
                />
              ) : null}

              <div className="relative z-10">
                <MarketingIconBadge
                  icon={cell.icon}
                  className="mb-3 transition-transform duration-300 group-hover:scale-105"
                />

                <h3 className="font-display text-lg font-semibold text-[var(--m-text)] transition-colors group-hover:text-[var(--m-accent)]">
                  {cell.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--m-muted)]">{cell.body}</p>
                {cell.callout ? (
                  <p className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--m-border)] bg-[var(--m-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--m-accent)]">
                    {cell.calloutIcon ? <MarketingIcon icon={cell.calloutIcon} size="sm" /> : null}
                    {cell.callout}
                  </p>
                ) : null}
              </div>
              {cell.screenshot ? (
                <div className="relative z-0 mt-6 transition-transform duration-500 group-hover:scale-[1.02] group-hover:-translate-y-1">
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
