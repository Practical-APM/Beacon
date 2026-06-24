import Link from 'next/link';
import { MarketingLogo } from '@/components/marketing/marketing-logo';
import { SmartAppLink } from '@/components/marketing/smart-app-link';

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-[var(--m-border)]/80 bg-[var(--m-surface-muted)]/50 backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent"
        aria-hidden
      />

      <div className="border-b border-[var(--m-border)] bg-[var(--m-accent-soft)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-[var(--m-text)]">Ready to see risk in your portfolio?</p>
            <p className="mt-1 text-sm text-[var(--m-muted)]">
              Try the prototype with demo data, or follow a guided walkthrough on the docs page.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/sign-in"
              className="marketing-btn-primary justify-center text-center sm:min-w-[140px]"
            >
              Try prototype
            </Link>
            <Link
              href="/docs#getting-started"
              className="marketing-btn-secondary justify-center text-center sm:min-w-[140px]"
            >
              Documentation
            </Link>
            <Link
              href="/docs?guide=try-prototype&step=0"
              className="marketing-btn-secondary justify-center text-center sm:min-w-[140px]"
            >
              Guided tour
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <MarketingLogo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--m-muted)]">
              Implementation risk intelligence for B2B teams. Know which go-lives will slip before
              revenue does.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--m-border)] bg-[var(--m-surface)] px-3 py-1 text-xs font-medium text-[var(--m-muted)]">
              Open source · Self-host or cloud
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--m-text)]">Product</p>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--m-muted)]">
              <li>
                <Link href="/#features" className="transition hover:text-[var(--m-accent)]">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#integrations" className="transition hover:text-[var(--m-accent)]">
                  Integrations
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="transition hover:text-[var(--m-accent)]">
                  Try the app
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="transition hover:text-[var(--m-accent)]">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--m-text)]">For teams</p>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--m-muted)]">
              <li>
                <SmartAppLink
                  signedInLabel="Open dashboard"
                  signedOutLabel="Sign in to workspace"
                  className="transition hover:text-[var(--m-accent)]"
                />
              </li>
              <li>
                <Link href="/docs#integrations" className="transition hover:text-[var(--m-accent)]">
                  Connect Salesforce & Jira
                </Link>
              </li>
              <li>
                <Link href="/docs#getting-started" className="transition hover:text-[var(--m-accent)]">
                  Self-hosting guide
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition hover:text-[var(--m-accent)]">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--m-text)]">Trust</p>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--m-muted)]">
              <li>
                <Link href="/security" className="transition hover:text-[var(--m-accent)]">
                  Security overview
                </Link>
              </li>
              <li>
                <Link href="/security#privacy" className="transition hover:text-[var(--m-accent)]">
                  Privacy tools
                </Link>
              </li>
              <li>
                <Link href="/security#roadmap" className="transition hover:text-[var(--m-accent)]">
                  Compliance roadmap
                </Link>
              </li>
              <li>
                <Link href="/legal/dpa" className="transition hover:text-[var(--m-accent)]">
                  Data Processing Agreement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--m-border)] pt-8 text-xs text-[var(--m-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Beacon</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/docs" className="hover:text-[var(--m-text)]">
              Documentation
            </Link>
            <Link href="/security" className="hover:text-[var(--m-text)]">
              Security
            </Link>
            <span>Open source · Self-hostable</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
