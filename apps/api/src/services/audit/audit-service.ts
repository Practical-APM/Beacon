import { auditEvents, withTenantContext, type Database } from '@beacon/db';
import type { AuditAction, RecordAuditInput } from '@beacon/shared/audit';
import { AUDIT_ACTIONS } from '@beacon/shared/audit';
import { desc, eq } from 'drizzle-orm';

export interface AuditListOptions {
  limit?: number;
  action?: AuditAction;
}

function serializeAudit(row: typeof auditEvents.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: row.metadata ?? {},
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordAuditEvent(db: Database, input: RecordAuditInput) {
  return withTenantContext(db, input.tenantId, async () => {
    const [row] = await db
      .insert(auditEvents)
      .values({
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
      .returning();
    return row ? serializeAudit(row) : null;
  });
}

export async function listAuditEvents(db: Database, tenantId: string, options: AuditListOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const actionFilter =
    options.action && AUDIT_ACTIONS.includes(options.action) ? options.action : undefined;

  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(auditEvents)
      .where(actionFilter ? eq(auditEvents.action, actionFilter) : undefined)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);

    return rows.map(serializeAudit);
  });
}

export function auditContextFromRequest(c: {
  req: { header: (name: string) => string | undefined };
}): Pick<RecordAuditInput, 'ipAddress' | 'userAgent'> {
  const forwarded = c.req.header('x-forwarded-for');
  return {
    ipAddress: forwarded?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  };
}
