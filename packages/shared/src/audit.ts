export const AUDIT_ACTIONS = [
  'integration_connected',
  'integration_disconnected',
  'integration_mapping_updated',
  'risk_acknowledged',
  'risk_snoozed',
  'risk_resolved',
  'gdpr_export_requested',
  'gdpr_deletion_requested',
  'gdpr_deletion_completed',
  'gdpr_deletion_rejected',
  'dpa_accepted',
  'webhook_subscription_created',
  'webhook_subscription_updated',
  'webhook_subscription_deleted',
  'recommendation_feedback_submitted',
  'risk_rules_updated',
  'benchmarks_refreshed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEventRecord {
  id: string;
  tenantId: string;
  userId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface RecordAuditInput {
  tenantId: string;
  userId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}
