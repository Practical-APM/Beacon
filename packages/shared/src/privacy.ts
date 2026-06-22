export const DELETION_REQUEST_STATUSES = ['pending', 'processing', 'completed', 'rejected'] as const;
export type DeletionRequestStatus = (typeof DELETION_REQUEST_STATUSES)[number];

export interface DeletionRequestRecord {
  id: string;
  tenantId: string;
  userId: string;
  status: DeletionRequestStatus;
  notes: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface GdprExportPayload {
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    timezone: string | null;
  };
  memberships: Array<{ tenantId: string; role: string }>;
  notificationPreferences: Record<string, unknown> | null;
  notifications: Array<Record<string, unknown>>;
}
