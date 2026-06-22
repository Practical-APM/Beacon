'use client';

import Link from 'next/link';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';

const principles = [
  {
    title: 'Open source core',
    body: 'The full risk engine, dashboard, and integrations are available to inspect, fork, and self-host. No black-box claims.',
  },
  {
    title: 'Try before you trust',
    body: 'Explore the prototype with demo data in under 30 seconds. Connect production systems only when you are ready.',
  },
  {
    title: 'Privacy you can verify',
    body: 'Self-serve data export, deletion requests, DPA acceptance, and tenant isolation are built into the product — not marketing slides.',
  },
  {
    title: 'No fake social proof',
    body: 'We will not publish fabricated testimonials or certification badges we have not earned. Early adopters shape the roadmap on GitHub.',
  },
];

export function OpenSourceSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Transparency</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900">
            Built in the open — no fake testimonials, no unearned badges
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Beacon is an open source platform in active development. Explore realistic demo metrics
            to see how the product works — we just will not invent customer quotes or compliance
            certificates.
          </p>
        </ScrollReveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {principles.map((item, index) => (
            <ScrollReveal key={item.title} delay={index * 0.08}>
              <article className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal className="mt-10" delay={0.2}>
          <p className="text-sm text-slate-600">
            Read the{' '}
            <Link href="/security" className="font-medium text-teal-700 hover:text-teal-800">
              security overview
            </Link>{' '}
            for what is implemented today, or{' '}
            <Link href="/docs" className="font-medium text-teal-700 hover:text-teal-800">
              browse the docs
            </Link>{' '}
            to self-host on your own infrastructure.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
