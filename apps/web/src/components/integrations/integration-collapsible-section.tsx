'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState, type ReactNode } from 'react';

export function IntegrationCollapsibleSection({
  id,
  title,
  description,
  statusBadge,
  defaultOpen = false,
  highlight = false,
  children,
}: {
  id: string;
  title: string;
  description: string;
  statusBadge?: ReactNode;
  defaultOpen?: boolean;
  highlight?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash === id) {
      setOpen(true);
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [id]);

  useEffect(() => {
    setOpen((current) => current || defaultOpen);
  }, [defaultOpen]);

  return (
    <section
      id={id}
      className={cn(
        'settings-section scroll-mt-24 overflow-hidden p-0',
        highlight && 'border-primary/25',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left sm:px-6"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="settings-section-title">{title}</h2>
            {statusBadge}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="border-t border-border px-5 pb-5 pt-1 sm:px-6">{children}</div> : null}
    </section>
  );
}
