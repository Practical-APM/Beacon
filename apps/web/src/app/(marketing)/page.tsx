import { BentoFeaturesSection } from '@/components/marketing/bento-features-section';
import { HeroSection } from '@/components/marketing/hero-section';
import { HowItWorksSection } from '@/components/marketing/how-it-works-section';
import { MarketingCtaSection } from '@/components/marketing/marketing-cta-section';
import {
  IntegrationLogoGrid,
  ProductShowcase,
} from '@/components/marketing/product-showcase';
import {
  MarketingSection,
  MarketingSectionHeader,
} from '@/components/marketing/marketing-section';
import { OutcomeSection } from '@/components/marketing/outcome-section';
import { OpenSourceSection } from '@/components/marketing/open-source-section';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Beacon | Implementation risk before revenue slips',
  description:
    'Open source SaaS that identifies which customer implementations will miss go-live, explains why, and recommends actions. Self-hostable with built-in privacy tools.',
};

export default function MarketingHomePage() {
  return (
    <main>
      <HeroSection />
      <OutcomeSection />
      <BentoFeaturesSection />
      <ProductShowcase />
      <HowItWorksSection />

      <MarketingSection id="integrations">
        <MarketingSectionHeader
          sectionIndex="05"
          eyebrow="Integrations"
          title="Connect the systems your team already uses"
          description="OAuth in minutes for Salesforce, Jira, Slack, and Calendar today. HubSpot, Dynamics, Linear, and more ship on the same guided setup path."
        />
        <IntegrationLogoGrid />
      </MarketingSection>

      <OpenSourceSection />
      <MarketingCtaSection />
    </main>
  );
}
