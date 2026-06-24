'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Link2, Sparkles, type LucideIcon } from 'lucide-react';
import {
  IntegrationBrandIcon,
  type IntegrationBrandId,
} from '@/components/marketing/integration-brand-icon';
import { MarketingSection, MarketingSectionHeader } from '@/components/marketing/marketing-section';
import { MarketingIcon } from '@/components/marketing/marketing-icon';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

const tabs: Array<{
  id: 'portfolio' | 'project' | 'integrations';
  label: string;
  icon: LucideIcon;
  description: string;
  screenshot: string;
  alt: string;
  title: string;
}> = [
  {
    id: 'portfolio',
    label: 'Portfolio dashboard',
    icon: LayoutDashboard,
    description:
      'See every active implementation, revenue at risk, and what needs attention today.',
    screenshot: MARKETING_SCREENSHOTS.dashboard,
    alt: 'Portfolio dashboard with metrics and at-risk projects',
    title: 'Beacon — Portfolio',
  },
  {
    id: 'project',
    label: 'Project intelligence',
    icon: Sparkles,
    description:
      'Predicted delays, AI root-cause analysis, and actionable recommendations per customer.',
    screenshot: MARKETING_SCREENSHOTS.project,
    alt: 'Project detail with predicted delay intervals and root cause analysis',
    title: 'Beacon — Acme Corp',
  },
  {
    id: 'integrations',
    label: 'Connections',
    icon: Link2,
    description: 'Connect Salesforce, Jira, Slack, and Calendar in minutes. No rip-and-replace.',
    screenshot: MARKETING_SCREENSHOTS.integrations,
    alt: 'Integrations page showing connected systems',
    title: 'Beacon — Connections',
  },
];

export function ProductShowcase() {
  const [active, setActive] = useState<(typeof tabs)[number]['id']>('portfolio');
  const current = tabs.find((t) => t.id === active)!;

  return (
    <MarketingSection id="product" divider>
      <MarketingSectionHeader
        sectionIndex="03"
        eyebrow="Product"
        title="Everything your team needs to protect go-live dates"
        description="From portfolio visibility to project-level predictions, Beacon gives technical and non-technical stakeholders a shared source of truth."
      />

      <ScrollReveal className="mt-10" delay={0.08}>
        <div className="marketing-tablist" role="tablist" aria-label="Product views">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={active === tab.id ? 'marketing-tab-active' : 'marketing-tab-inactive'}
            >
              <MarketingIcon icon={tab.icon} size="sm" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={`desc-${active}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--m-muted)]"
          >
            {current.description}
          </motion.p>
        </AnimatePresence>
      </ScrollReveal>

      <ScrollReveal className="mt-8" delay={0.12}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            role="tabpanel"
            id={`panel-${active}`}
            aria-labelledby={`tab-${active}`}
            initial={{ opacity: 0, y: 20, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.99 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="marketing-screenshot-halo" aria-hidden />
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

const liveIntegrations: Array<{
  name: string;
  brand: IntegrationBrandId;
  accent: string;
}> = [
  { name: 'Salesforce', brand: 'salesforce', accent: '#00A1E0' },
  { name: 'Jira', brand: 'jira', accent: '#2684FF' },
  { name: 'Slack', brand: 'slack', accent: '#E01E5A' },
  { name: 'Google Calendar', brand: 'google-calendar', accent: '#4285F4' },
];

export function IntegrationLogoGrid() {
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {liveIntegrations.map((item, index) => (
          <ScrollReveal key={item.name} delay={index * 0.06}>
            <article
              className="marketing-integration-card group"
              style={{ '--integration-accent': item.accent } as CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="marketing-integration-logo-well">
                  <IntegrationBrandIcon brand={item.brand} size={30} />
                </div>
                <span className="marketing-integration-live">Live</span>
              </div>
              <h3 className="mt-5 font-display text-base font-semibold text-[var(--m-text)]">
                {item.name}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--m-muted)]">
                OAuth · Continuous sync
              </p>
            </article>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delay={0.2}>
        <div className="marketing-roadmap-panel">
          <p className="marketing-roadmap-label">On the roadmap</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {comingSoon.map((name) => (
              <span key={name} className="marketing-roadmap-chip">
                {name}
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm text-[var(--m-muted)]">
            Same guided setup when they ship — OAuth in minutes, no rip-and-replace.{' '}
            <Link href="/docs#integrations" className="marketing-text-link">
              See current integrations
            </Link>
          </p>
        </div>
      </ScrollReveal>
    </div>
  );
}
