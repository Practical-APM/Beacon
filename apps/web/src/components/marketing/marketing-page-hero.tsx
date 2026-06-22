import { MarketingSection, MarketingSectionHeader } from '@/components/marketing/marketing-section';
import type { ReactNode } from 'react';

export function MarketingPageHero({
  title,
  description,
  align = 'left',
  children,
}: {
  title: string;
  description: string;
  align?: 'left' | 'center';
  children?: ReactNode;
}) {
  return (
    <MarketingSection
      className="border-b border-slate-200 bg-gradient-to-b from-teal-50/40 to-[var(--m-bg)] py-16 sm:py-20"
      innerClassName={align === 'center' ? 'mx-auto max-w-4xl text-center' : 'max-w-3xl'}
    >
      <MarketingSectionHeader title={title} description={description} align={align} />
      {children}
    </MarketingSection>
  );
}
