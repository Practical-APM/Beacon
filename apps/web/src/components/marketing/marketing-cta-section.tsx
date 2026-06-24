'use client';

import Link from 'next/link';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { SmartAppLink } from '@/components/marketing/smart-app-link';

export function MarketingCtaSection() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32 marketing-cta-premium marketing-section-divider">
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <ScrollReveal>
          <p className="marketing-section-label justify-center">
            <span className="marketing-section-index">§ 07</span>
            <span>Closing entry</span>
          </p>

          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            The next go-live slip does not have to be a surprise.
          </h2>

          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            Create a workspace, explore with sample data, then connect your stack and invite your
            team. No credit card. Self-host whenever you are ready.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-in" className="marketing-btn-primary marketing-btn-lg w-full sm:w-auto">
              Start free
            </Link>
            <Link
              href="/docs?guide=try-prototype&step=0"
              className="marketing-btn-secondary w-full sm:w-auto"
            >
              Tour with sample data
            </Link>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            <Link href="/pricing" className="marketing-text-link">
              Compare plans
            </Link>
            <span className="mx-3" aria-hidden>
              ·
            </span>
            <Link href="/security" className="marketing-text-link">
              Enterprise: security overview
            </Link>
            <span className="mx-3" aria-hidden>
              ·
            </span>
            <SmartAppLink
              variant="ghost"
              signedInLabel="Open your workspace"
              signedOutLabel="Sign in to the app"
              className="inline-flex !px-0 !py-0 text-sm text-[var(--m-accent)] hover:underline"
            />
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
