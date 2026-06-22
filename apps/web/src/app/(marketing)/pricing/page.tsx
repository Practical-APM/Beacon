import Link from 'next/link';
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
                  ? 'border-teal-300 bg-white ring-2 ring-teal-200 lg:-translate-y-1 lg:shadow-lg'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {plan.featured ? (
                <span className="absolute -top-3 left-6 rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              ) : null}
              <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
                {plan.price}
                {plan.price.startsWith('$') ? (
                  <span className="text-base font-normal text-slate-500"> / seat / mo</span>
                ) : null}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{plan.detail}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <span className="font-semibold text-teal-600" aria-hidden>
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 ${
                  plan.featured
                    ? 'bg-teal-700 text-white hover:bg-teal-800'
                    : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-slate-600">
          All plans include the same risk engine.{' '}
          <Link href="/docs?guide=try-prototype&step=0" className="font-medium text-teal-700 hover:text-teal-800">
            Start with the prototype guide
          </Link>{' '}
          or{' '}
          <Link href="/faq" className="font-medium text-teal-700 hover:text-teal-800">
            read the FAQ
          </Link>{' '}
          for licensing, data handling, and support details.
        </p>
      </MarketingSection>
    </main>
  );
}
