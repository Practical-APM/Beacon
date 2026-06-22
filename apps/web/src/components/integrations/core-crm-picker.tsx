'use client';

import { cn } from '@/lib/utils';
import type { CoreCrmPreferenceOption } from '@beacon/shared/integrations';

export type CoreCrmPreferenceState = {
  coreCrmId: string;
  coreCrmName: string;
  options: CoreCrmPreferenceOption[];
  locked: boolean;
  lockedReason: string | null;
  connectedCoreCrmId: string | null;
};

export function CoreCrmPicker({
  preference,
  selectedId,
  onSelect,
  disabled = false,
  compact = false,
}: {
  preference: CoreCrmPreferenceState;
  selectedId: string;
  onSelect: (coreCrmId: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'lg:grid-cols-2')}>
      {preference.options.map((option) => {
        const selected = selectedId === option.id;
        const isDisabled = disabled || preference.locked || !option.selectable;

        return (
          <button
            key={option.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onSelect(option.id)}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              selected
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:bg-accent/30',
              isDisabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
              option.availability === 'coming_soon' && 'border-dashed',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{option.name}</p>
                {!option.selectable ? (
                  <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Roadmap
                  </span>
                ) : selected ? (
                  <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Selected
                  </span>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
            {!compact ? (
              <ul className="mt-3 space-y-1">
                {option.signals.slice(0, 2).map((signal) => (
                  <li key={signal} className="text-xs text-muted-foreground">
                    · {signal}
                  </li>
                ))}
              </ul>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
