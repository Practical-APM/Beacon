'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { MarketingBackground } from '@/components/marketing/marketing-background';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { SmartAppLink } from '@/components/marketing/smart-app-link';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

const trustItems = ['Open source', 'Self-hostable', 'Privacy tools', 'Demo available'];

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden marketing-hero-premium">
      <MarketingBackground />
      <div className="marketing-hero-spotlight" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-6 lg:pb-24 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
          <div className="max-w-xl">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 shadow-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
              Open source · Self-hostable
            </motion.div>

            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 text-[2.5rem] font-semibold leading-[1.06] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]"
            >
              Know which go-lives will slip before revenue slips
            </motion.h1>

            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 text-lg leading-relaxed text-slate-600"
            >
              Beacon connects Salesforce, Jira, Slack, and Calendar into one implementation risk
              workspace. See what is at risk, why, and what to do next.
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            >
              <Link href="/sign-in" className="marketing-btn-primary justify-center">
                Try the prototype
              </Link>
              <SmartAppLink variant="secondary" className="justify-center" />
            </motion.div>

            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="mt-4 text-sm text-slate-500"
            >
              No sales call. Explore demo data in under 30 seconds.
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-2"
            >
              {trustItems.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200/90 bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative lg:pl-4"
          >
            <div className={reduceMotion ? '' : 'marketing-float'}>
              <ScreenshotFrame
                src={MARKETING_SCREENSHOTS.dashboard}
                alt="Beacon portfolio dashboard showing active implementations and projects at risk"
                title="Beacon — Portfolio"
                glow
              />
            </div>
            <div className="marketing-hero-badge absolute -bottom-4 left-4 hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg sm:block">
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <span
                    className={`h-1.5 w-1.5 rounded-full bg-amber-500 ${reduceMotion ? '' : 'motion-safe:animate-pulse-soft'}`}
                    aria-hidden
                  />
                  Revenue at risk today
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Demo
                </span>
              </p>
              <p className="text-lg font-semibold text-amber-600">$185K across 3 projects</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
