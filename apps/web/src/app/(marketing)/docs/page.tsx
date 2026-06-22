import { Suspense } from 'react';
import { DocsPageContent } from '@/components/marketing/docs-page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation | Beacon',
  description:
    'Guided walkthroughs and reference docs for deploying Beacon, connecting integrations, and triaging implementation risk.',
};

export default function DocsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-5 py-24 text-center text-slate-600 sm:px-6">
          Loading documentation…
        </main>
      }
    >
      <DocsPageContent />
    </Suspense>
  );
}
