'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { MarketingIcon } from '@/components/marketing/marketing-icon';

const without: Array<{ text: string; icon: LucideIcon }> = [
  { text: 'Weekly status meetings to reconcile Salesforce, Jira, and Slack', icon: BarChart3 },
  { text: 'Escalations only after milestones slip', icon: AlertTriangle },
  { text: 'Leadership learns about delays from the customer', icon: Users },
];

const withBeacon: Array<{ text: string; icon: LucideIcon }> = [
  { text: 'Portfolio view of every at-risk implementation', icon: Target },
  { text: 'Predicted delay ranges with confidence intervals', icon: TrendingUp },
  { text: 'Recommended actions before revenue is impacted', icon: Zap },
];

const statsRow = [
  { value: '25–30%', label: 'fewer delays' },
  { value: '2× faster', label: 'escalation detection' },
  { value: '80%+', label: 'prediction accuracy' },
];

export function OutcomeSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden marketing-outcome-section py-24 sm:py-32 marketing-section-divider">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center lg:text-left">
            <p className="marketing-section-label justify-center lg:justify-start">
              <span className="marketing-section-index">§ 01</span>
              <span>The problem</span>
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              From reactive firefighting
              <br />
              <span className="text-[var(--m-accent)]">to proactive revenue protection</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              Beacon does not replace your stack. It connects it so your team acts on risk, not reports.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.08} className="mt-12">
          <div className="grid grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-white/5 px-8 py-6 backdrop-blur-sm sm:gap-8">
            {statsRow.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
                className="text-center"
              >
                <p className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </ScrollReveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <ScrollReveal delay={0.05}>
            <div className="marketing-outcome-without-card h-full rounded-2xl p-7">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Today
              </p>
              <ul className="mt-6 space-y-4">
                {without.map((item) => (
                  <li key={item.text} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-slate-300">
                      <MarketingIcon icon={item.icon} size="sm" />
                    </span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <div className="marketing-outcome-with-card h-full rounded-2xl p-7">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--m-accent)]">
                With Beacon
              </p>
              <ul className="mt-6 space-y-4">
                {withBeacon.map((item) => (
                  <li key={item.text} className="flex gap-3 text-sm leading-relaxed text-teal-50">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
                      <MarketingIcon icon={item.icon} size="sm" />
                    </span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
