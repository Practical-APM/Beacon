import Link from 'next/link';
import { Check } from 'lucide-react';
import { MarketingPageHero } from '@/components/marketing/marketing-page-hero';
import { MarketingSection } from '@/components/marketing/marketing-section';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Beacon',
  description: 'Community self-hosting free forever. Cloud plans for managed hosting and enterprise.',
};

const plans = [
  {
    name: 'Community',
    price: 'Free',
    detail: 'Self-host the full open source stack on your infrastructure.',
    features: [
      'Full risk engine and dashboard',
      'All integrations',
      'Privacy and GDPR tools',
      'Community support via GitHub',
    ],
    cta: 'Self-host guide',
    href: '/docs?guide=self-host&step=0',
    featured: false,
  },
  {
    name: 'Cloud Starter',
    price: '$49',
    detail: 'Per seat / month. Managed hosting for growing implementation teams.',
    features: [
      'Everything in Community',
      'Managed Postgres and Redis',
      'Email support',
      'Automatic updates',
    ],
    cta: 'Try prototype',
    href: '/docs?guide=try-prototype&step=0',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    detail: 'SSO, dedicated support, custom SLAs, and private deployment options.',
    features: [
      'SAML / SSO',
      'Dedicated success manager',
      '99.9% SLA',
      'Custom data residency',
    ],
    cta: 'Read security',
    href: '/security',
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <main>
      <MarketingPageHero
        title="Simple, transparent pricing"
        description="Start free with self-hosting. Upgrade when you want managed cloud, support, and enterprise controls. No sales call required to begin."
        align="center"
      />
      <MarketingSection className="py-16">
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 shadow-sm transition hover:shadow-md ${
                plan.featured
                  ? 'border-teal-500/50 bg-[var(--m-surface)] ring-2 ring-teal-500/25 lg:-translate-y-1 lg:shadow-lg'
                  : 'border-[var(--m-border)] bg-[var(--m-surface)]'
              }`}
            >
              {plan.featured ? (
                <span className="absolute -top-3 left-6 rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              ) : null}
              <h2 className="font-display text-lg font-semibold text-[var(--m-text)]">{plan.name}</h2>
              <p className="mt-4 font-display text-4xl font-semibold tracking-tight text-[var(--m-text)]">
                {plan.price}
                {plan.price.startsWith('$') ? (
                  <span className="text-base font-normal text-[var(--m-muted)]"> / seat / mo</span>
                ) : null}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--m-muted)]">{plan.detail}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-[var(--m-muted)]">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--m-accent)]" strokeWidth={1.5} aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 ${
                  plan.featured
                    ? 'marketing-btn-primary text-center'
                    : 'marketing-btn-secondary text-center'
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-[var(--m-muted)]">
          All plans include the same risk engine.{' '}
          <Link href="/docs?guide=try-prototype&step=0" className="font-medium text-[var(--m-accent)] hover:underline">
            Start with the prototype guide
          </Link>{' '}
          or{' '}
          <Link href="/faq" className="font-medium text-[var(--m-accent)] hover:underline">
            read the FAQ
          </Link>{' '}
          for licensing, data handling, and support details.
        </p>
      </MarketingSection>
    </main>
  );
}
