'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useAppSession } from '@/components/providers/app-session-provider';

type SmartAppLinkProps = {
  className?: string;
  signedInLabel?: string;
  signedOutLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'ghostOnDark';
};

export function SmartAppLink({
  className,
  signedInLabel = 'Open the app',
  signedOutLabel = 'Open the app',
  variant = 'secondary',
}: SmartAppLinkProps) {
  const { externalAuthId, loading } = useAppSession();
  const href = !loading && externalAuthId ? '/dashboard' : '/sign-in';
  const label = !loading && externalAuthId ? signedInLabel : signedOutLabel;

  const styles = {
    primary: 'marketing-btn-primary',
    secondary: 'marketing-btn-secondary',
    ghost:
      'inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--m-accent)] transition hover:text-[var(--m-text)]',
    ghostOnDark: 'marketing-btn-ghost-on-dark',
  };

  return (
    <Link href={href} className={cn(styles[variant], className)}>
      {label}
    </Link>
  );
}
