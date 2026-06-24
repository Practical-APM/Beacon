'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [scrolled, setScrolled] = useState(false);
  const onMarketingHome = pathname === '/';
  const { externalAuthId, loading } = useAppSession();
  const signedIn = !loading && Boolean(externalAuthId);
  const lastScrollY = useRef(0);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 12);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300 marketing-nav-glass',
          scrolled && 'scrolled',
        )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <MarketingLogo />

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          {links.map((link) => {
            const active = isMarketingNavActive(pathname, link.href, onMarketingHome);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'marketing-nav-link text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
                  active ? 'text-[var(--m-accent)]' : 'text-[var(--m-muted)] hover:text-[var(--m-text)]',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {!signedIn ? (
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--m-muted)] transition-colors hover:text-[var(--m-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
            >
              Sign in
            </Link>
          ) : null}
          <SmartAppLink
            variant="primary"
            className="marketing-btn-primary marketing-btn-sm"
            signedInLabel="Open app"
            signedOutLabel="Start free"
          />
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-[var(--m-border)] p-2 text-[var(--m-text)] transition-all hover:bg-[var(--m-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="h-5 w-5" aria-hidden />
              </motion.span>
            ) : (
              <motion.span
                key="menu"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-nav"
            key="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-[var(--m-border)] bg-[var(--m-surface)]/95 backdrop-blur-xl md:hidden"
            role="dialog"
            aria-label="Mobile navigation"
          >
            <nav className="flex flex-col gap-0.5 px-5 py-4" aria-label="Main">
              {links.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                >
                  <Link
                    href={link.href}
                    className={cn(
                      'block rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-[var(--m-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
                      isMarketingNavActive(pathname, link.href, onMarketingHome)
                        ? 'bg-[var(--m-accent-soft)] text-[var(--m-accent)]'
                        : 'text-[var(--m-text)]',
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              {!signedIn ? (
                <Link
                  href="/sign-in"
                  className="block rounded-xl px-3 py-3 text-sm font-medium text-[var(--m-text)] transition-colors hover:bg-[var(--m-accent-soft)]"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </Link>
              ) : null}
              <SmartAppLink
                variant="primary"
                className="mt-3 justify-center rounded-xl px-4 py-3 text-center text-sm font-medium"
                signedInLabel="Open app"
                signedOutLabel="Start free"
              />
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
