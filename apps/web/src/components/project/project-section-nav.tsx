'use client';

import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'project-overview', label: 'Overview' },
  { id: 'predicted-delay', label: 'Delay forecast' },
  { id: 'project-risks', label: 'Risks' },
  { id: 'ai-explanation', label: 'Why flagged' },
  { id: 'activity-timeline', label: 'Timeline' },
] as const;

export function ProjectSectionNav({ hasRisks }: { hasRisks: boolean }) {
  const sections = hasRisks
    ? SECTIONS
    : SECTIONS.filter((section) => section.id !== 'project-risks' && section.id !== 'ai-explanation');

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav
      aria-label="Project sections"
      className="no-print -mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px"
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => scrollTo(section.id)}
          className={cn(
            'shrink-0 rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            section.id === 'project-risks' &&
              hasRisks &&
              'text-destructive hover:text-destructive',
          )}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
