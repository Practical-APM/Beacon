'use client';

import { useAppSession } from '@/components/providers/app-session-provider';
import { cn } from '@/lib/utils';

export function TenantSwitcher() {
  const { me, activeTenantId, setActiveTenantId } = useAppSession();

  if (!me || me.memberships.length === 0) {
    return null;
  }

  if (me.memberships.length === 1) {
    const membership = me.memberships[0]!;
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
        {membership.tenantName}
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">Organization</span>
      <select
        className={cn(
          'rounded-md border border-border bg-card px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary',
        )}
        value={activeTenantId ?? ''}
        onChange={(event) => void setActiveTenantId(event.target.value)}
      >
        <option value="" disabled>
          Select organization
        </option>
        {me.memberships.map((membership) => (
          <option key={membership.tenantId} value={membership.tenantId}>
            {membership.tenantName} ({membership.role})
          </option>
        ))}
      </select>
    </label>
  );
}
