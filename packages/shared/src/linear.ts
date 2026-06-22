export const LINEAR_OAUTH_SCOPES = ['read'] as const;

export interface LinearIntegrationMetadata {
  organizationId: string;
  organizationName: string;
  mappingComplete: boolean;
  syncProgress?: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    recordsProcessed: number;
    recordsTotal: number | null;
    startedAt?: string;
    completedAt?: string;
    error?: string | null;
  };
}

export function validateLinearIntegrationMetadata(
  metadata: Partial<LinearIntegrationMetadata>,
): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!metadata.organizationId?.trim()) missing.push('organizationId');
  return { complete: missing.length === 0, missing };
}

export function mapLinearWorkflowState(
  state: string,
): 'todo' | 'in_progress' | 'done' {
  const normalized = state.trim().toLowerCase();
  if (
    normalized.includes('done') ||
    normalized.includes('complete') ||
    normalized.includes('closed') ||
    normalized.includes('cancelled') ||
    normalized.includes('canceled')
  ) {
    return 'done';
  }
  if (
    normalized.includes('progress') ||
    normalized.includes('review') ||
    normalized.includes('blocked') ||
    normalized.includes('started')
  ) {
    return 'in_progress';
  }
  return 'todo';
}
