'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { SCREENSHOT_ASPECT } from '@/lib/marketing-screenshots';
import { cn } from '@/lib/utils';

type ScreenshotFrameProps = {
  src: string;
  alt: string;
  title?: string;
  className?: string;
  glow?: boolean;
  compact?: boolean;
  statusLabel?: string;
  live?: boolean;
};

export function ScreenshotFrame({
  src,
  alt,
  title = 'Beacon',
  className,
  glow = false,
  compact = false,
  statusLabel = 'Sample data',
  live = false,
}: ScreenshotFrameProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn('relative', glow && 'marketing-screenshot-glow', className)}>
      <div
        className={cn(
          'mockup-window overflow-hidden rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)]',
          compact && 'rounded-lg',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between gap-3 border-b border-[var(--m-border)] bg-[var(--m-surface-muted)]/80 px-4',
            compact ? 'py-2' : 'py-2.5',
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="mockup-chrome-dot bg-[#FF5F57]" />
            <span className="mockup-chrome-dot bg-[#FEBC2E]" />
            <span className="mockup-chrome-dot bg-[#28C840]" />
            <span className="truncate text-xs font-medium text-[var(--m-muted)]">{title}</span>
          </div>
          {statusLabel ? (
            <span className={cn('marketing-mockup-status shrink-0', live && 'marketing-mockup-status-live')}>
              {live ? 'Live status' : statusLabel}
            </span>
          ) : null}
        </div>
        <div
          className="relative w-full overflow-hidden bg-[#0a101c]"
          style={{ aspectRatio: String(SCREENSHOT_ASPECT) }}
        >
          {failed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--m-surface-muted)] px-4 text-center">
              <ImageOff className="h-8 w-8 text-[var(--m-muted)]" aria-hidden />
              <p className="text-sm font-medium text-[var(--m-text)]">Preview unavailable</p>
              <p className="text-xs text-[var(--m-muted)]">{alt}</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              width={1200}
              height={720}
              className="absolute inset-0 h-full w-full object-contain object-left-top"
              loading="eager"
              decoding="async"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
