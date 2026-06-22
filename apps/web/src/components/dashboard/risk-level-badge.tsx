import { AlertCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEVEL_CONFIG = {
  critical: {
    label: 'Critical Risk',
    icon: ShieldAlert,
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  high: {
    label: 'High Risk',
    icon: AlertTriangle,
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  },
  medium: {
    label: 'Medium Risk',
    icon: AlertCircle,
    className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200',
  },
  low: {
    label: 'Low Risk',
    icon: Info,
    className: 'border-border bg-muted/40 text-muted-foreground',
  },
} as const;

export function RiskLevelBadge({ level }: { level: string }) {
  const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.low;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        config.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}
