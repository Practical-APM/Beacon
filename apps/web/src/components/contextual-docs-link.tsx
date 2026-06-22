'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { contextualDocsGuide, contextualDocsLabel } from '@/lib/contextual-docs';
import { cn } from '@/lib/utils';

function useContextualDocs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  return {
    href: contextualDocsGuide(pathname, search),
    label: contextualDocsLabel(pathname, search),
  };
}

function ContextualDocsLinkInner({ className }: { className?: string }) {
  const { href, label } = useContextualDocs();

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline',
        className,
      )}
    >
      <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export function ContextualDocsLink({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <ContextualDocsLinkInner className={className} />
    </Suspense>
  );
}

function AppShellHelpLinkInner({
  helpHint,
  mobile = false,
}: {
  helpHint: string;
  mobile?: boolean;
}) {
  const { href, label } = useContextualDocs();

  if (mobile) {
    return (
      <Link
        href={href}
        className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={label}
      >
        <BookOpen className="h-5 w-5" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug opacity-80">{helpHint}</span>
      </span>
    </Link>
  );
}

export function AppShellHelpLink({
  helpHint,
  mobile = false,
}: {
  helpHint: string;
  mobile?: boolean;
}) {
  return (
    <Suspense fallback={mobile ? null : undefined}>
      <AppShellHelpLinkInner helpHint={helpHint} mobile={mobile} />
    </Suspense>
  );
}
