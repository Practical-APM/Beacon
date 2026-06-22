export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-xl border border-border bg-card" />
        <div className="h-36 rounded-xl border border-border bg-card" />
      </div>
      <div className="h-24 rounded-xl border border-border bg-card" />
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-16 rounded-lg border border-border bg-card" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-44 rounded-xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading project">
      <div className="space-y-3 border-b border-border pb-6">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-4 w-full max-w-md rounded bg-muted" />
      </div>
      <div className="h-48 rounded-xl border border-border bg-card" />
      <div className="h-56 rounded-xl border border-border bg-card" />
      <div className="h-40 rounded-xl border border-border bg-card" />
      <div className="h-64 rounded-xl border border-border bg-card" />
    </div>
  );
}
