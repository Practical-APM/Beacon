import { ExternalLink, Link2Off } from 'lucide-react';
import { resolveEvidenceLink, type EvidenceItem } from '@/lib/evidence-links';

export function EvidenceLink({ item }: { item: EvidenceItem }) {
  const { href, unavailable } = resolveEvidenceLink(item);

  if (unavailable || !href) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Link2Off className="h-3.5 w-3.5" aria-hidden="true" />
        Source record unavailable
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      Open in {item.source ?? 'source'}
    </a>
  );
}
