'use client';

import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { MarketingSection, MarketingSectionHeader } from '@/components/marketing/marketing-section';

const without = [
  'Weekly status meetings to reconcile Salesforce, Jira, and Slack',
  'Escalations only after milestones slip',
  'Leadership learns about delays from the customer',
];

const withBeacon = [
  'Portfolio view of every at-risk implementation',
  'Predicted delay ranges with confidence intervals',
  'Recommended actions before revenue is impacted',
];

export function OutcomeSection() {
  return (
    <MarketingSection variant="dark" className="marketing-outcome-section">
      <MarketingSectionHeader
        eyebrow="The shift"
        title="From reactive firefighting to proactive revenue protection"
        description="Beacon does not replace your stack. It connects it so your team acts on risk, not reports."
        dark
        align="center"
      />

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <ScrollReveal delay={0.05}>
          <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Without Beacon</p>
            <ul className="mt-5 space-y-4">
              {without.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div className="h-full rounded-2xl border border-teal-400/30 bg-teal-950/40 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-300">With Beacon</p>
            <ul className="mt-5 space-y-4">
              {withBeacon.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-teal-50">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs text-teal-300">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>
      </div>
    </MarketingSection>
  );
}
