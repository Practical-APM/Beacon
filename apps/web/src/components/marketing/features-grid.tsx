'use client';

import { MarketingSection, MarketingSectionHeader } from '@/components/marketing/marketing-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';

const features = [
  {
    title: 'Portfolio risk dashboard',
    body: 'See every active implementation, revenue at risk, and which projects need attention today.',
    icon: (
      <path
        d="M4 12h3v5H4v-5zm4.5-4h3v9h-3V8zm4.5 2h3v7h-3v-7zm4.5-3h3v10h-3V7z"
        fill="currentColor"
      />
    ),
  },
  {
    title: 'Predicted delay intervals',
    body: 'Heuristic go-live delay estimates with 80% confidence intervals — transparent, not black-box.',
    icon: (
      <path
        d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm1 5v5l4 2-.9 1.8L11 14V8h2z"
        fill="currentColor"
      />
    ),
  },
  {
    title: 'Root-cause intelligence',
    body: 'AI explanations backed by evidence from CRM, tickets, Slack threads, and calendar gaps.',
    icon: (
      <path
        d="M12 2a7 7 0 0 0-4 12.7V18a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.3A7 7 0 0 0 12 2zm0 2a5 5 0 0 1 3.5 8.6L15 13v3h-2v-3l-.5-.4A5 5 0 0 1 12 4z"
        fill="currentColor"
      />
    ),
  },
  {
    title: 'Peer benchmarks',
    body: 'Opt-in cohort comparisons so leaders know if a delay is unusual for similar implementations.',
    icon: (
      <path
        d="M4 18h16v2H4v-2zm2-4h3v3H6v-3zm4-3h3v6h-3v-6zm4-2h3v8h-3V9z"
        fill="currentColor"
      />
    ),
  },
  {
    title: 'Privacy by design',
    body: 'GDPR export and deletion, DPA acceptance, and tenant isolation built into the product.',
    icon: (
      <path
        d="M12 1 4 4v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V4l-8-3zm0 2.2 6 2.25V10c0 4.4-2.9 8.6-6 9.8-3.1-1.2-6-5.4-6-9.8V5.45l6-2.25z"
        fill="currentColor"
      />
    ),
  },
  {
    title: 'Open source core',
    body: 'Self-host the full stack for free. No vendor lock-in, no feature gating on the risk engine.',
    icon: (
      <path
        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 15v-4H7l5-9v4h4l-5 9z"
        fill="currentColor"
      />
    ),
  },
];

export function FeaturesGrid() {
  return (
    <MarketingSection variant="muted">
      <MarketingSectionHeader
        eyebrow="Capabilities"
        title="Built for technical and non-technical stakeholders"
        description="Implementation managers get actionable detail. Executives get portfolio-level clarity. Everyone shares one source of truth."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 0.06}>
              <article className="group h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-100">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
    </MarketingSection>
  );
}
