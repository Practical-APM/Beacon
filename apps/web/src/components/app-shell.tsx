'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { TenantSwitcher } from '@/components/tenant-switcher';
import { NotificationCenter } from '@/components/notification-center';
import { AppFooter } from '@/components/app-footer';
import { TrustBadges } from '@/components/trust-badges';
import { SkipLink } from '@/components/skip-link';
import { useAppSession } from '@/components/providers/app-session-provider';
import { useTranslation } from '@/components/providers/i18n-provider';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Link2, Settings, ExternalLink } from 'lucide-react';
import { AppShellHelpLink } from '@/components/contextual-docs-link';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, signOut } = useAppSession();
  const { t } = useTranslation();

  const nav = [
    {
      href: '/dashboard',
      label: t('nav.dashboard'),
      hint: t('nav.dashboardHint'),
      icon: LayoutDashboard,
    },
    {
      href: '/integrations',
      label: t('nav.integrations'),
      hint: t('nav.integrationsHint'),
      icon: Link2,
    },
    {
      href: '/settings',
      label: t('nav.settings'),
      hint: t('nav.settingsHint'),
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-background lg:flex">
      <SkipLink />
      <aside className="hidden border-r border-border bg-card lg:flex lg:w-72 lg:shrink-0 lg:flex-col">
        <div className="flex h-full flex-col px-5 py-6">
          <div className="mb-8">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image
                src="/marketing/logo-mark.svg"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9"
                aria-hidden
              />
              <div>
                <p className="text-base font-semibold tracking-tight text-foreground">
                  {t('app.productName')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('app.tagline')}</p>
              </div>
            </Link>
          </div>

          <nav className="space-y-1">
            {nav.map((item) => {
              const active =
                item.href === '/dashboard'
                  ? pathname === '/dashboard' || pathname.startsWith('/projects/')
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug opacity-80">{item.hint}</span>
                  </span>
                </Link>
              );
            })}
            <AppShellHelpLink helpHint={t('nav.helpHint')} />
          </nav>

          <div className="mt-8">
            <TrustBadges compact />
          </div>

          <div className="mt-auto space-y-3 pt-8 text-xs text-muted-foreground">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Website home
            </Link>
            <p>{t('app.complianceNote')}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
              <Image
                src="/marketing/logo-mark.svg"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7"
                aria-hidden
              />
              <span className="truncate text-sm font-semibold">{t('app.productName')}</span>
            </Link>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <AppShellHelpLink helpHint={t('nav.helpHint')} mobile />
              <NotificationCenter />
              <TenantSwitcher />
              <div className="hidden text-right text-xs sm:block">
                <p className="font-medium text-foreground">{me?.user.name ?? me?.user.email}</p>
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={signOut}
                >
                  {t('nav.signOut')}
                </button>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:hidden"
                onClick={signOut}
              >
                {t('nav.signOut')}
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-6">
          {children}
        </main>
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
          <AppFooter />
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
          {nav.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname.startsWith('/projects/')
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
