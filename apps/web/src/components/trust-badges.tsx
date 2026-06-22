export function TrustBadges({ compact = false }: { compact?: boolean }) {
  const badges = [
    { label: 'Open source', detail: 'Inspect the full codebase' },
    { label: 'Self-hostable', detail: 'Run on your infrastructure' },
    { label: 'Privacy tools', detail: 'Export, deletion, and DPA' },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span key={badge.label} className="trust-badge" title={badge.detail}>
            {badge.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {badges.map((badge) => (
        <div key={badge.label} className="surface-card p-4">
          <p className="text-sm font-medium text-foreground">{badge.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{badge.detail}</p>
        </div>
      ))}
    </div>
  );
}
