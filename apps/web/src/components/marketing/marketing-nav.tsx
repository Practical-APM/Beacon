'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { MarketingLogo } from '@/components/marketing/marketing-logo';
import { SmartAppLink } from '@/components/marketing/smart-app-link';
import { useAppSession } from '@/components/providers/app-session-provider';
import { cn } from '@/lib/utils';

const links = [
  { href: '/#features', label: 'Features' },
  { href: '/#product', label: 'Product' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/docs', label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/faq', label: 'FAQ' },
];

function isMarketingNavActive(pathname: string, href: string, onMarketingHome: boolean): boolean {
  if (href.startsWith('/#')) return onMarketingHome;
  if (href === '/docs') return pathname.startsWith('/docs');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const onMarketingHome = pathname === '/';
  const { externalAuthId, loading } = useAppSession();
  const signedIn = !loading && Boolean(externalAuthId);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <MarketingLogo />

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
                link.href.startsWith('/#')
                  ? onMarketingHome
                    ? 'text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                  : isMarketingNavActive(pathname, link.href, onMarketingHome)
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {!signedIn ? (
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
            >
              Sign in
            </Link>
          ) : null}
          <SmartAppLink
            variant="primary"
            className="rounded-lg px-4 py-2 text-sm font-medium shadow-sm"
            signedInLabel="Open app"
            signedOutLabel="Try prototype"
          />
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-slate-200 bg-white px-5 py-4 md:hidden"
          role="dialog"
          aria-label="Mobile navigation"
        >
          <nav className="flex flex-col gap-0.5" aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
                  isMarketingNavActive(pathname, link.href, onMarketingHome)
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-800',
                )}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!signedIn ? (
              <Link
                href="/sign-in"
                className="rounded-lg px-3 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            ) : null}
            <SmartAppLink
              variant="primary"
              className="mt-3 justify-center rounded-lg px-4 py-3 text-center text-sm font-medium"
              signedInLabel="Open app"
              signedOutLabel="Try prototype"
            />
          </nav>
        </div>
      ) : null}
    </header>
  );
}
