export function formatCurrency(amount: number | null | undefined, currency = 'USD'): string {
  if (amount == null) return 'Unknown';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDays(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value} ${value === 1 ? 'Day' : 'Days'}`;
}

export function formatRelativeUpdated(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** Whole days from now until the given ISO date. Negative means past due. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDaysUntil(iso: string | null | undefined): string {
  const days = daysUntil(iso);
  if (days == null) return '—';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} past due`;
  if (days === 0) return 'Due today';
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

export function isStaleData(iso: string, thresholdMinutes = 10): boolean {
  return Date.now() - new Date(iso).getTime() > thresholdMinutes * 60_000;
}
