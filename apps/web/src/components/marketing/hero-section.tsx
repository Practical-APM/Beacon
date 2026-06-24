'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

const specTiles = [
  { label: 'License', value: 'Open source core' },
  { label: 'Deploy', value: 'Self-host · Docker' },
  { label: 'Cost', value: '$0 to start' },
  { label: 'Integrations', value: '4 live today' },
];

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden marketing-hero-premium">
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-6 lg:pb-24 lg:pt-20">
        <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl"
          >
            <p className="marketing-section-label">
              <span className="marketing-section-index">§ 00</span>
              <span>Open source · Self-hostable</span>
            </p>

            <h1 className="mt-5 font-display text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.04em] text-[var(--m-text)] sm:text-5xl lg:text-[3.25rem]">
              Every go-live risk, visible.{' '}
              <span className="text-[var(--m-accent)]">Before revenue slips.</span>
            </h1>

            <p className="mt-5 text-base leading-relaxed text-[var(--m-muted)] sm:text-lg">
              Leadership gets one portfolio view of what is at risk. Implementation teams see
              why, with evidence from Salesforce, Jira, Slack, and Calendar. Connect your stack;
              your developers change nothing.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/sign-in" className="marketing-btn-primary justify-center">
                Start free
              </Link>
              <Link
                href="/docs?guide=try-prototype&step=0"
                className="marketing-btn-secondary justify-center"
              >
                Tour with sample data
              </Link>
            </div>

            <p className="mt-4 text-sm text-[var(--m-muted)]">
              No credit card. Explore demo data in under 30 seconds.
            </p>

            <p className="marketing-provider-strip mt-8">
              Works with{' '}
              <span>Salesforce</span>
              <span className="marketing-provider-dot" aria-hidden>
                ·
              </span>
              <span>Jira</span>
              <span className="marketing-provider-dot" aria-hidden>
                ·
              </span>
              <span>Slack</span>
              <span className="marketing-provider-dot" aria-hidden>
                ·
              </span>
              <span>Google Calendar</span>
            </p>

            <dl className="marketing-spec-grid mt-10">
              {specTiles.map((tile) => (
                <div key={tile.label} className="marketing-spec-tile">
                  <dt>{tile.label}</dt>
                  <dd>{tile.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="relative lg:pt-2"
          >
            <ScreenshotFrame
              src={MARKETING_SCREENSHOTS.dashboard}
              alt="Beacon portfolio dashboard showing active implementations and projects at risk"
              title="Portfolio overview"
              statusLabel="Sample data"
            />
            <div className="marketing-hero-metric-rail" aria-hidden>
              <div className="marketing-hero-metric-card">
                <p className="marketing-hero-metric-label">Month to date</p>
                <p className="marketing-hero-metric-value">$185K</p>
                <p className="marketing-hero-metric-sub">revenue at risk</p>
              </div>
              <div className="marketing-hero-metric-card">
                <p className="marketing-hero-metric-label">At risk</p>
                <p className="marketing-hero-metric-value">3</p>
                <p className="marketing-hero-metric-sub">projects today</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
