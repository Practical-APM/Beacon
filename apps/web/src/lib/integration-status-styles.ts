export type IntegrationConnectionStatus =
  | 'connected'
  | 'degraded'
  | 'disconnected'
  | 'syncing'
  | 'loading';

export function integrationStatusLabel(status: IntegrationConnectionStatus | undefined): string {
  if (!status || status === 'disconnected') return 'Not connected';
  if (status === 'loading') return 'Loading…';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function integrationStatusClass(status: IntegrationConnectionStatus | undefined): string {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400';
    case 'syncing':
      return 'bg-amber-500/10 text-amber-800 dark:text-amber-400';
    case 'degraded':
      return 'bg-orange-500/10 text-orange-800 dark:text-orange-400';
    case 'loading':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function integrationWarningClass(): string {
  return 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm';
}

export function integrationWarningTitleClass(): string {
  return 'font-medium text-amber-950 dark:text-amber-100';
}
