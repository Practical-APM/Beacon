import Link from 'next/link';
import { MarketingLogo } from '@/components/marketing/marketing-logo';
import { SmartAppLink } from '@/components/marketing/smart-app-link';

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-slate-200 bg-gradient-to-b from-slate-50/80 to-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent"
        aria-hidden
      />

      {/* Evaluator CTA — helps teams go from marketing to product in one click */}
      <div className="border-b border-slate-200/80 bg-teal-950/[0.03]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-slate-900">Ready to see risk in your portfolio?</p>
            <p className="mt-1 text-sm text-slate-600">
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
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
              Implementation risk intelligence for B2B teams. Know which go-lives will slip before
              revenue does.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Open source · Self-host or cloud
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Product</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>
                <Link href="/#features" className="transition hover:text-teal-700">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#integrations" className="transition hover:text-teal-700">
                  Integrations
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="transition hover:text-teal-700">
                  Try the app
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="transition hover:text-teal-700">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">For teams</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>
                <SmartAppLink
                  signedInLabel="Open dashboard"
                  signedOutLabel="Sign in to workspace"
                  className="transition hover:text-teal-700"
                />
              </li>
              <li>
                <Link href="/docs#integrations" className="transition hover:text-teal-700">
                  Connect Salesforce & Jira
                </Link>
              </li>
              <li>
                <Link href="/docs#getting-started" className="transition hover:text-teal-700">
                  Self-hosting guide
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition hover:text-teal-700">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Trust</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>
                <Link href="/security" className="transition hover:text-teal-700">
                  Security overview
                </Link>
              </li>
              <li>
                <Link href="/security#privacy" className="transition hover:text-teal-700">
                  Privacy tools
                </Link>
              </li>
              <li>
                <Link href="/security#roadmap" className="transition hover:text-teal-700">
                  Compliance roadmap
                </Link>
              </li>
              <li>
                <Link href="/legal/dpa" className="transition hover:text-teal-700">
                  Data Processing Agreement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-slate-200 pt-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Beacon</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/docs" className="hover:text-slate-700">
              Documentation
            </Link>
            <Link href="/security" className="hover:text-slate-700">
              Security
            </Link>
            <span>Open source · Self-hostable</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
