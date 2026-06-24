import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type MarketingSectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  variant?: 'default' | 'muted' | 'dark';
  divider?: boolean;
};

const variants = {
  default: '',
  muted: 'bg-[var(--m-surface-muted)]/40 backdrop-blur-md',
  dark: 'bg-[var(--m-dark)]/90 text-white backdrop-blur-md',
};

export function MarketingSection({
  id,
  children,
  className,
  innerClassName,
  variant = 'default',
  divider = true,
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'relative scroll-mt-20 py-20 sm:py-28',
        divider && 'marketing-section-divider',
        variants[variant],
        className,
      )}
    >
      <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8', innerClassName)}>
        {children}
      </div>
    </section>
  );
}

export function MarketingSectionHeader({
  sectionIndex,
  eyebrow,
  title,
  description,
  align = 'left',
  dark = false,
}: {
  sectionIndex?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  dark?: boolean;
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      {sectionIndex || eyebrow ? (
        <p className={cn('marketing-section-label', align === 'center' && 'justify-center')}>
          {sectionIndex ? <span className="marketing-section-index">§ {sectionIndex}</span> : null}
          {eyebrow ? <span>{eyebrow}</span> : null}
        </p>
      ) : null}
      <h2
        className={cn(
          'mt-4 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]',
          dark ? 'text-white' : 'text-[var(--m-text)]',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-4 max-w-2xl text-base leading-relaxed sm:text-lg',
            dark ? 'text-slate-400' : 'text-[var(--m-muted)]',
            align === 'center' && 'mx-auto',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
