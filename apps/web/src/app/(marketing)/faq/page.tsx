import Link from 'next/link';
import { FaqAccordion } from '@/components/marketing/faq-accordion';
import { MarketingPageHero } from '@/components/marketing/marketing-page-hero';
import { MarketingSection } from '@/components/marketing/marketing-section';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ | Beacon',
  description: 'Answers about pricing, security, open source, and data handling.',
};

const faqs = [
  {
    question: 'What is Beacon?',
    answer:
      'Beacon is an open source implementation risk platform for B2B teams. It connects to your CRM, project management, and communication tools to identify which customer implementations are likely to miss their go-live date, explain root causes, and recommend actions before revenue is impacted.',
  },
  {
    question: 'Is Beacon really open source?',
    answer:
      'Yes. The core platform is open source and free to self-host. You get the full risk engine, dashboard, integrations framework, and privacy controls. Cloud tiers add managed hosting, SLAs, and enterprise features like SSO and dedicated support.',
  },
  {
    question: 'How is this different from Jira or Salesforce reports?',
    answer:
      'Project tools track work. CRM tracks customers. Beacon connects both and predicts delivery risk using cross-system signals: overdue milestones, customer inactivity, revenue at risk, and predicted delay intervals.',
  },
  {
    question: 'Do you convert currencies?',
    answer:
      'No. Beacon displays ARR in each project\'s native currency. You can choose how numbers are formatted (US, UK, EU, etc.) in Settings without changing underlying amounts.',
  },
  {
    question: 'What compliance certifications do you have?',
    answer:
      'Beacon does not claim certifications we have not earned. The product includes GDPR-oriented privacy tools (export, deletion, DPA), tenant isolation, encryption, and audit logging. See the Security page for what is implemented today and our compliance roadmap.',
  },
  {
    question: 'Can I self-host for free?',
    answer:
      'Yes. The Community edition includes the full application stack. You provide PostgreSQL, Redis, and your OAuth credentials for integrations.',
  },
  {
    question: 'How do predicted delay confidence intervals work?',
    answer:
      'Beacon estimates slip beyond the target go-live using open risk signals and peer benchmark dispersion when your organization opts into anonymized benchmarking.',
  },
  {
    question: 'Who should use Beacon?',
    answer:
      'Implementation leaders, customer success executives, professional services directors, and revenue leaders who need portfolio visibility without waiting for weekly status meetings.',
  },
  {
    question: 'How do I get support?',
    answer:
      'Community support via GitHub issues and documentation. Cloud customers receive email support with defined response times. Enterprise plans include dedicated success and SLA-backed uptime.',
  },
  {
    question: 'Can I try it without talking to sales?',
    answer:
      'Absolutely. Click Try the prototype on the homepage, sign in, and explore a workspace with demo data. Documentation and FAQs cover setup end to end.',
  },
];

export default function FaqPage() {
  return (
    <main>
      <MarketingPageHero
        title="Frequently asked questions"
        description="Common questions about Beacon, from open source licensing to enterprise compliance and data handling."
      />
      <MarketingSection className="py-16" innerClassName="max-w-3xl">
        <FaqAccordion items={faqs} />
      </MarketingSection>

      <MarketingSection variant="muted" className="py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-xl font-semibold text-slate-900">Still evaluating?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Jump into a guided walkthrough or review security controls before you connect production
            data.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/docs?guide=try-prototype&step=0" className="marketing-btn-primary">
              Try the prototype
            </Link>
            <Link href="/docs?guide=connect-stack&step=0" className="marketing-btn-secondary">
              Connect your stack
            </Link>
            <Link href="/security" className="marketing-btn-secondary">
              Security overview
            </Link>
          </div>
        </div>
      </MarketingSection>
    </main>
  );
}
