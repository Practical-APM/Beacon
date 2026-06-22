'use client';

import { cn } from '@/lib/utils';

type FeedbackBannerProps = {
  variant: 'success' | 'error' | 'warning';
  message: string;
  onDismiss?: () => void;
};

export function FeedbackBanner({ variant, message, onDismiss }: FeedbackBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        'motion-safe:animate-fade-in flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm',
        variant === 'success'
          ? 'border border-success/30 bg-success/10 text-success'
          : variant === 'warning'
            ? 'border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-50'
            : 'border border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <p>{message}</p>
      {onDismiss ? (
        <button
          type="button"
          className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
