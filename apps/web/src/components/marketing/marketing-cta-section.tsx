'use client';

import Link from 'next/link';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { SmartAppLink } from '@/components/marketing/smart-app-link';

export function MarketingCtaSection() {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-24 text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(20,184,166,0.15),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop finding out about delays after they happen
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Start predicting them before they impact revenue. Try the prototype with demo data, or
            open your workspace if you are already set up.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-in"
              className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:w-auto"
            >
              Try the prototype
            </Link>
            <SmartAppLink
              variant="secondary"
              signedInLabel="Open your workspace"
              signedOutLabel="Sign in to the app"
              className="w-full border-white/25 bg-transparent text-white hover:border-white/40 hover:bg-white/10 sm:w-auto"
            />
          </div>
          <p className="mt-6 text-sm text-slate-400">
            <Link href="/pricing" className="text-teal-300 transition hover:text-teal-200">
              Compare plans
            </Link>
            {' · '}
            <Link href="/docs?guide=try-prototype&step=0" className="text-teal-300 transition hover:text-teal-200">
              Start guided tour
            </Link>
            {' · '}
            <Link href="/docs" className="text-teal-300 transition hover:text-teal-200">
              Read documentation
            </Link>
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
