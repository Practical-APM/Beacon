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
  /** Smaller chrome for bento cards */
  compact?: boolean;
};

export function ScreenshotFrame({
  src,
  alt,
  title = 'Beacon',
  className,
  glow = false,
  compact = false,
}: ScreenshotFrameProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn('relative', glow && 'marketing-screenshot-glow', className)}>
      <div
        className={cn(
          'mockup-window overflow-hidden rounded-2xl border border-slate-200/80 bg-white',
          compact && 'rounded-xl',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-4',
            compact ? 'py-2' : 'py-3',
          )}
        >
          <span className="mockup-chrome-dot bg-[#FF5F57]" />
          <span className="mockup-chrome-dot bg-[#FEBC2E]" />
          <span className="mockup-chrome-dot bg-[#28C840]" />
          <span className="ml-3 truncate text-xs font-medium text-slate-500">{title}</span>
        </div>
        <div
          className="relative w-full overflow-hidden bg-slate-50"
          style={{ aspectRatio: String(SCREENSHOT_ASPECT) }}
        >
          {failed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 px-4 text-center">
              <ImageOff className="h-8 w-8 text-slate-400" aria-hidden />
              <p className="text-sm font-medium text-slate-600">Preview unavailable</p>
              <p className="text-xs text-slate-500">{alt}</p>
            </div>
          ) : (
            // Native img — reliable for SVG product demos (Next/Image breaks many vector assets).
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
