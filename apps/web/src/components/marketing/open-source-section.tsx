'use client';

import Link from 'next/link';
import { Code2, Eye, ShieldCheck, Sparkles } from 'lucide-react';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { MarketingIconBadge } from '@/components/marketing/marketing-icon';

const principles = [
  {
    title: 'Open source core',
    body: 'The full risk engine, dashboard, and integrations are available to inspect, fork, and self-host. No black-box claims.',
    icon: Code2,
  },
  {
    title: 'Try before you trust',
    body: 'Explore the prototype with demo data in under 30 seconds. Connect production systems only when you are ready.',
    icon: Eye,
  },
  {
    title: 'Privacy you can verify',
    body: 'Self-serve data export, deletion requests, DPA acceptance, and tenant isolation are built into the product — not marketing slides.',
    icon: ShieldCheck,
  },
  {
    title: 'No fake social proof',
    body: 'We will not publish fabricated testimonials or certification badges we have not earned. Early adopters shape the roadmap on GitHub.',
    icon: Sparkles,
  },
];

export function OpenSourceSection() {
  return (
    <section className="py-24 marketing-section-divider sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="marketing-section-label">
            <span className="marketing-section-index">§ 06</span>
            <span>Transparency</span>
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-[var(--m-text)]">
            Built in the open — no fake testimonials, no unearned badges
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--m-muted)]">
            Beacon is an open source platform in active development. Explore realistic demo metrics
            to see how the product works — we just will not invent customer quotes or compliance
            certificates.
          </p>
        </ScrollReveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {principles.map((item, index) => (
            <ScrollReveal key={item.title} delay={index * 0.08}>
              <article className="marketing-principle-card">
                <MarketingIconBadge icon={item.icon} className="mb-4" />
                <h3 className="font-display text-lg font-semibold text-[var(--m-text)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--m-muted)]">{item.body}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal className="mt-10" delay={0.2}>
          <p className="text-sm text-[var(--m-muted)]">
            Read the{' '}
            <Link href="/security" className="font-medium text-[var(--m-accent)] hover:underline">
              security overview
            </Link>{' '}
            for what is implemented today, or{' '}
            <Link href="/docs" className="font-medium text-[var(--m-accent)] hover:underline">
              browse the docs
            </Link>{' '}
            to self-host on your own infrastructure.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
