'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';

const stats = [
  { value: 47, suffix: '%', label: 'Fewer surprise go-live slips', detail: 'Teams catch risk weeks earlier' },
  { value: 12, suffix: ' hrs', label: 'Saved per week on status prep', detail: 'Less manual reconciliation' },
  { value: 4, suffix: '', label: 'Integrations out of the box', detail: 'Salesforce, Jira, Slack, Calendar' },
  { value: 80, suffix: '%', label: 'Prediction confidence intervals', detail: 'Transparent delay ranges' },
];

function AnimatedStat({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion || !inView) {
      if (inView) setDisplay(value);
      return;
    }

    let frame = 0;
    const totalFrames = 36;
    const timer = window.setInterval(() => {
      frame += 1;
      setDisplay(Math.round((value * frame) / totalFrames));
      if (frame >= totalFrames) window.clearInterval(timer);
    }, 24);

    return () => window.clearInterval(timer);
  }, [inView, reduceMotion, value]);

  return (
    <span ref={ref} className="text-4xl font-semibold tracking-tight text-teal-700 sm:text-5xl">
      {display}
      {suffix}
    </span>
  );
}

export function StatsSection() {
  return (
    <section className="relative overflow-hidden border-y border-slate-200 bg-slate-900 py-20 text-white">
      <div className="marketing-grid-bg absolute inset-0 opacity-20" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="text-center text-sm font-semibold uppercase tracking-wide text-teal-300">
            Outcomes teams care about
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight">
            Clarity before the escalation meeting
          </h2>
        </ScrollReveal>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <ScrollReveal key={stat.label} delay={index * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <AnimatedStat value={stat.value} suffix={stat.suffix} />
                <p className="mt-3 text-sm font-semibold text-white">{stat.label}</p>
                <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
