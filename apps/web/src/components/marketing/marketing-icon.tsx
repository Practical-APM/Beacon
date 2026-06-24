import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const sizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

type MarketingIconProps = {
  icon: LucideIcon;
  className?: string;
  size?: keyof typeof sizes;
};

export function MarketingIcon({ icon: Icon, className, size = 'md' }: MarketingIconProps) {
  return <Icon className={cn(sizes[size], className)} strokeWidth={1.5} aria-hidden />;
}

export function MarketingIconBadge({
  icon,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--m-border)] bg-[var(--m-accent-soft)] text-[var(--m-accent)] transition-colors',
        className,
      )}
    >
      <MarketingIcon icon={icon} className={iconClassName} />
    </span>
  );
}
