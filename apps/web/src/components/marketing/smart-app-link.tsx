'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useAppSession } from '@/components/providers/app-session-provider';

type SmartAppLinkProps = {
  className?: string;
  signedInLabel?: string;
  signedOutLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
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
      'inline-flex items-center rounded-xl px-4 py-3 text-sm font-medium text-teal-700 transition hover:text-teal-800',
  };

  return (
    <Link href={href} className={cn(styles[variant], className)}>
      {label}
    </Link>
  );
}
