import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type MarketingSectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  variant?: 'default' | 'muted' | 'dark';
};

const variants = {
  default: 'bg-[var(--m-bg)]',
  muted: 'bg-[var(--m-surface-muted)]',
  dark: 'bg-[var(--m-dark)] text-white',
};

export function MarketingSection({
  id,
  children,
  className,
  innerClassName,
  variant = 'default',
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn('relative scroll-mt-20 py-20 sm:py-28', variants[variant], className)}
    >
      <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8', innerClassName)}>
        {children}
      </div>
    </section>
  );
}

export function MarketingSectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  dark = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  dark?: boolean;
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <p
          className={cn(
            'text-xs font-semibold uppercase tracking-[0.14em]',
            dark ? 'text-teal-300' : 'text-teal-700',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'mt-3 text-3xl font-semibold tracking-tight sm:text-4xl',
          dark ? 'text-white' : 'text-slate-900',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-4 text-lg leading-relaxed',
            dark ? 'text-slate-300' : 'text-slate-600',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
