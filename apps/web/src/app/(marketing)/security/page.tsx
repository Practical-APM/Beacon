import Link from 'next/link';
import { MarketingPageHero } from '@/components/marketing/marketing-page-hero';
import { MarketingSection } from '@/components/marketing/marketing-section';
import { SecurityInAppControls } from '@/components/marketing/security-in-app-controls';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security & Privacy | Beacon',
  description:
    'What Beacon implements today: encryption, access controls, privacy tools, and tenant isolation. No unearned certification claims.',
};

const sections = [
  {
    id: 'honesty',
    title: 'What we claim — and what we do not',
    body: 'Beacon does not display compliance certificates we have not earned. This page describes security and privacy controls that exist in the product today. If you need a vendor security questionnaire for a production evaluation, contact us through GitHub or your cloud plan.',
  },
  {
    id: 'privacy',
    title: 'Privacy and GDPR-oriented tools',
    body: 'Data subject rights are supported through self-serve export and deletion requests in Settings. Processing agreements are available for every organization. Data minimization is applied to LLM prompts and benchmark cohorts.',
  },
  {
    id: 'encryption',
    title: 'Encryption and infrastructure',
    body: 'Data is encrypted in transit (TLS 1.2+) and at rest. Integration credentials are encrypted with tenant-specific keys. Self-hosted deployments run entirely on your infrastructure; cloud deployments support private networking and customer-managed keys on Enterprise plans.',
  },
  {
    id: 'access',
    title: 'Access control and audit logging',
    body: 'Role-based access includes executive, operational, contributor, and admin roles with project-level scoping for contributors. Admin actions are written to an immutable audit log you can review in the app.',
  },
  {
    id: 'isolation',
    title: 'Tenant isolation',
    body: 'Each organization\'s data is isolated at the database layer. Integration credentials, project data, and audit events are scoped to the tenant that owns them.',
  },
  {
    id: 'roadmap',
    title: 'Compliance roadmap',
    body: 'We are building toward SOC 2 and ISO 27001 aligned practices as the platform matures. We will publish certification status only after an independent audit is complete — not before.',
  },
];

export default function SecurityPage() {
  return (
    <main>
      <MarketingPageHero
        title="Security and privacy"
        description="An honest overview of what Beacon implements today. Review these controls before you connect production data."
      />
      <MarketingSection className="py-16">
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'Review the DPA',
              body: 'Accept the data processing agreement in-app before connecting production CRM data.',
              href: '/legal/dpa',
              label: 'Read DPA',
            },
            {
              title: 'Privacy controls',
              body: 'Export or delete tenant data, and review processing agreements per organization.',
              href: '/settings?tab=privacy',
              label: 'Open privacy settings',
            },
            {
              title: 'Self-host evaluation',
              body: 'Run the full stack locally to inspect code paths and network boundaries yourself.',
              href: '/docs?guide=self-host&step=0',
              label: 'Self-host guide',
            },
          ].map((item) => (
            <article
              key={item.href}
              className="rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-5 shadow-sm"
            >
              <h2 className="font-semibold text-[var(--m-text)]">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--m-muted)]">{item.body}</p>
              <Link
                href={item.href}
                className="mt-4 inline-flex text-sm font-medium text-teal-700 hover:text-teal-800"
              >
                {item.label} →
              </Link>
            </article>
          ))}
        </div>

        <SecurityInAppControls />

        <nav className="mb-10 flex flex-wrap gap-2 lg:hidden" aria-label="Security topics">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-[var(--m-border)] bg-[var(--m-surface)] px-3 py-1.5 text-sm font-medium text-[var(--m-muted)] transition hover:border-[var(--m-accent)]/40 hover:text-[var(--m-accent)]"
            >
              {section.title}
            </a>
          ))}
        </nav>

        <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1 text-sm" aria-label="Security topics">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--m-muted)]">
                Topics
              </p>
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-[var(--m-muted)] transition hover:bg-[var(--m-accent-soft)] hover:text-[var(--m-accent)]"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-6">
            {sections.map((section) => (
              <article
                key={section.id}
                id={section.id}
                className="scroll-mt-24 rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-8 shadow-sm"
              >
                <h2 className="text-xl font-semibold text-[var(--m-text)]">{section.title}</h2>
                <p className="mt-3 leading-relaxed text-[var(--m-muted)]">{section.body}</p>
              </article>
            ))}
            <p className="text-sm text-[var(--m-muted)]">
              Accept the{' '}
              <Link href="/legal/dpa" className="font-medium text-teal-700 hover:text-teal-800">
                Data Processing Agreement
              </Link>{' '}
              in the app before connecting production integrations.
            </p>
          </div>
        </div>
      </MarketingSection>
    </main>
  );
}
