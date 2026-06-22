'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { RISK_LEVELS } from '@beacon/shared/constants';
import { cn } from '@/lib/utils';

export interface RiskFeedFilters {
  level: string;
  owner: string;
  createdAfter: string;
  createdBefore: string;
}

interface DashboardFiltersProps {
  filters: RiskFeedFilters;
  owners: string[];
  onChange: (filters: RiskFeedFilters) => void;
}

function countActiveFilters(filters: RiskFeedFilters): number {
  return [filters.level, filters.owner, filters.createdAfter, filters.createdBefore].filter(
    Boolean,
  ).length;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
      {label}
      <button
        type="button"
        className="rounded-full p-0.5 hover:bg-primary/15"
        aria-label={`Remove ${label} filter`}
        onClick={onRemove}
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}

export function DashboardFilters({ filters, owners, onChange }: DashboardFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);
  const hasActiveFilters = activeCount > 0;

  const chips = useMemo(() => {
    const items: Array<{ key: keyof RiskFeedFilters; label: string }> = [];
    if (filters.level) {
      items.push({
        key: 'level',
        label: `${filters.level.charAt(0).toUpperCase()}${filters.level.slice(1)}+`,
      });
    }
    if (filters.owner) {
      items.push({ key: 'owner', label: filters.owner });
    }
    if (filters.createdAfter) {
      items.push({ key: 'createdAfter', label: `From ${filters.createdAfter}` });
    }
    if (filters.createdBefore) {
      items.push({ key: 'createdBefore', label: `To ${filters.createdBefore}` });
    }
    return items;
  }, [filters]);

  const filterFields = (
    <>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Risk level
        <select
          className="form-input min-w-[140px]"
          value={filters.level}
          onChange={(event) => onChange({ ...filters, level: event.target.value })}
        >
          <option value="">All levels</option>
          {RISK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Owner
        <select
          className="form-input min-w-[180px]"
          value={filters.owner}
          onChange={(event) => onChange({ ...filters, owner: event.target.value })}
        >
          <option value="">All owners</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        From
        <input
          type="date"
          className="form-input"
          value={filters.createdAfter}
          onChange={(event) => onChange({ ...filters, createdAfter: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        To
        <input
          type="date"
          className="form-input"
          value={filters.createdBefore}
          onChange={(event) => onChange({ ...filters, createdBefore: event.target.value })}
        />
      </label>

      {hasActiveFilters ? (
        <button
          type="button"
          className="btn-secondary px-3 py-2 text-sm"
          onClick={() => onChange({ level: '', owner: '', createdAfter: '', createdBefore: '' })}
        >
          Clear all
        </button>
      ) : null}
    </>
  );

  return (
    <div className="settings-section overflow-hidden p-0">
      <div className="hidden border-b border-border px-4 py-2 sm:block">
        <p className="text-xs text-muted-foreground">
          Focus on your book of business.{' '}
          <Link href="/docs?guide=triage-risk&step=0" className="font-medium text-primary hover:underline">
            Filter walkthrough
          </Link>
        </p>
      </div>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:hidden"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
          Filter risks
          {hasActiveFilters ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {activeCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">Active:</span>
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              onRemove={() => onChange({ ...filters, [chip.key]: '' })}
            />
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          'flex flex-wrap items-end gap-3 p-4',
          expanded ? 'border-t border-border sm:border-t-0' : 'hidden sm:flex',
        )}
      >
        {filterFields}
      </div>
    </div>
  );
}
