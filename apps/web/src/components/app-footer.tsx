'use client';

import Link from 'next/link';

export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-border pt-8 pb-4">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Beacon</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Open source implementation intelligence. Know which customer go-lives are at risk
            before revenue is impacted.
          </p>
        </div>
        <div className="grid gap-6 text-sm sm:grid-cols-3">
          <div>
            <p className="font-medium text-foreground">Product</p>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li>
                <Link href="/docs?guide=connect-stack&step=0" className="hover:text-foreground">
                  Setup walkthrough
                </Link>
              </li>
              <li>
                <Link href="/docs?guide=triage-risk&step=0" className="hover:text-foreground">
                  Triage guide
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-foreground">
                  Help center
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-foreground">
                  FAQs
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Trust</p>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li>
                <Link href="/security" className="hover:text-foreground">
                  Security & compliance
                </Link>
              </li>
              <li>
                <Link href="/legal/dpa" className="hover:text-foreground">
                  Data Processing Agreement
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Website</p>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Marketing home
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com"
                  className="hover:text-foreground"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open source
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Beacon. Built for implementation teams who need
        clarity, not another status meeting.
      </p>
    </footer>
  );
}
