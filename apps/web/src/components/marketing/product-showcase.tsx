'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketingSection, MarketingSectionHeader } from '@/components/marketing/marketing-section';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

const tabs = [
  {
    id: 'portfolio',
    label: 'Portfolio dashboard',
    description:
      'See every active implementation, revenue at risk, and what needs attention today.',
    screenshot: MARKETING_SCREENSHOTS.dashboard,
    alt: 'Portfolio dashboard with metrics and at-risk projects',
    title: 'Beacon — Portfolio',
  },
  {
    id: 'project',
    label: 'Project intelligence',
    description:
      'Predicted delays, AI root-cause analysis, and actionable recommendations per customer.',
    screenshot: MARKETING_SCREENSHOTS.project,
    alt: 'Project detail with predicted delay intervals and root cause analysis',
    title: 'Beacon — Acme Corp',
  },
  {
    id: 'integrations',
    label: 'Connections',
    description: 'Connect Salesforce, Jira, Slack, and Calendar in minutes. No rip-and-replace.',
    screenshot: MARKETING_SCREENSHOTS.integrations,
    alt: 'Integrations page showing connected systems',
    title: 'Beacon — Connections',
  },
] as const;

export function ProductShowcase() {
  const [active, setActive] = useState<(typeof tabs)[number]['id']>('portfolio');
  const current = tabs.find((t) => t.id === active)!;

  return (
    <MarketingSection id="product">
      <MarketingSectionHeader
        eyebrow="Product"
        title="Everything your team needs to protect go-live dates"
        description="From portfolio visibility to project-level predictions, Beacon gives technical and non-technical stakeholders a shared source of truth."
      />

      <ScrollReveal className="mt-10" delay={0.08}>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product views">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 ${
                active === tab.id
                  ? 'bg-teal-700 text-white shadow-md shadow-teal-700/15'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">{current.description}</p>
      </ScrollReveal>

      <ScrollReveal className="mt-8" delay={0.12}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            role="tabpanel"
            id={`panel-${active}`}
            aria-labelledby={`tab-${active}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <ScreenshotFrame
              src={current.screenshot}
              alt={current.alt}
              title={current.title}
            />
          </motion.div>
        </AnimatePresence>
      </ScrollReveal>
    </MarketingSection>
  );
}

export function IntegrationLogoGrid() {
  const live = [
    { name: 'Salesforce', logo: '/marketing/integrations/salesforce.svg' },
    { name: 'Jira', logo: '/marketing/integrations/jira.svg' },
    { name: 'Slack', logo: '/marketing/integrations/slack.svg' },
    { name: 'Google Calendar', logo: '/marketing/integrations/calendar.svg' },
  ];

  const comingSoon = [
    'HubSpot',
    'Dynamics 365',
    'Pipedrive',
    'Linear',
    'Asana',
    'Microsoft Teams',
  ];

  return (
    <div className="mt-12 space-y-8">
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 rounded-2xl border border-slate-200/90 bg-white px-8 py-10 sm:gap-x-14">
        {live.map((item, index) => (
          <ScrollReveal key={item.name} delay={index * 0.04}>
            <div className="flex flex-col items-center gap-3 text-center">
              <Image src={item.logo} alt="" width={44} height={44} className="h-11 w-11" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">OAuth · Continuous sync</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On the roadmap</p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-slate-600">
          {comingSoon.map((name) => (
            <span key={name} className="rounded-full border border-slate-200 bg-white px-3 py-1">
              {name}
            </span>
          ))}
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Same guided setup when they ship — OAuth in minutes, no rip-and-replace.{' '}
          <Link href="/docs#integrations" className="font-medium text-teal-700 hover:text-teal-800">
            See current integrations
          </Link>
        </p>
      </div>
    </div>
  );
}
