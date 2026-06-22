import { Eye } from 'lucide-react';

type ContributorReadOnlyBannerProps = {
  /** Short context, e.g. "integrations" or "risk actions" */
  context: string;
  /** Optional admin contact hint */
  adminHint?: string;
};

export function ContributorReadOnlyBanner({ context, adminHint }: ContributorReadOnlyBannerProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
      role="status"
    >
      <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-medium">View-only access</p>
        <p className="mt-1 text-muted-foreground">
          You can review {context}, but changes require an admin or operational lead.
          {adminHint ? ` ${adminHint}` : ''}
        </p>
      </div>
    </div>
  );
}
