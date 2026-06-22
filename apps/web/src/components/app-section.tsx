import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type AppSectionProps = {
  id?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AppSection({
  id,
  title,
  description,
  children,
  className,
  contentClassName,
}: AppSectionProps) {
  return (
    <section id={id} className={cn('settings-section', className)}>
      {title ? <h2 className="settings-section-title">{title}</h2> : null}
      {description ? <p className="settings-section-lead">{description}</p> : null}
      <div className={cn(title || description ? 'mt-5' : undefined, contentClassName)}>{children}</div>
    </section>
  );
}
