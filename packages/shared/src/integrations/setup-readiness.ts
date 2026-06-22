import {
  DEFAULT_CORE_CRM_ID,
  getIntegrationCatalogEntry,
  type IntegrationCatalogId,
} from './catalog.js';

export type CoreCrmReadinessSnapshot = {
  connected: boolean;
  status: string;
  mappingComplete: boolean;
  lastSyncAt: string | null;
  syncProgress?: {
    recordsProcessed?: number;
    recordsTotal?: number | null;
  } | null;
};

export type OptionalIntegrationReadinessSnapshot = {
  connected: boolean;
  status: string;
};

/** Snapshot shape used by dashboard and connections pages. */
export type IntegrationReadinessSnapshot = {
  coreCrmId?: IntegrationCatalogId;
  coreCrm?: CoreCrmReadinessSnapshot;
  workItems?: OptionalIntegrationReadinessSnapshot;
  engagement?: OptionalIntegrationReadinessSnapshot;
  /** Beacon projects with no Jira mapping (when Jira is connected). */
  unlinkedJiraProjectCount?: number;
  /** Jira projects with no Beacon mapping. */
  jiraOrphanProjectCount?: number;
};

export type SetupBlocker = {
  id: string;
  label: string;
  why: string;
  fixHref: string;
  fixLabel: string;
  required: boolean;
};

export type SetupReadiness = {
  coreCrmId: IntegrationCatalogId;
  coreCrmName: string;
  /** Core CRM connected, field mappings complete, and at least one sync has run. */
  isReadyForCoreIntelligence: boolean;
  /** Core CRM plus recommended optional integrations connected. */
  isFullyConnected: boolean;
  /** True while core CRM bulk sync is running before the first successful sync. */
  syncInProgress: boolean;
  syncProgress?: {
    recordsProcessed?: number;
    recordsTotal?: number | null;
  };
  blockers: SetupBlocker[];
  nextBlocker: SetupBlocker | null;
};

function resolveSnapshot(snapshot: IntegrationReadinessSnapshot): {
  coreCrmId: IntegrationCatalogId;
  coreCrm: CoreCrmReadinessSnapshot;
  workItems: OptionalIntegrationReadinessSnapshot;
  engagement: OptionalIntegrationReadinessSnapshot;
} {
  const coreCrmId = snapshot.coreCrmId ?? DEFAULT_CORE_CRM_ID;
  const coreCrm = snapshot.coreCrm ?? {
    connected: false,
    status: 'disconnected',
    mappingComplete: false,
    lastSyncAt: null,
  };
  const workItems = snapshot.workItems ?? { connected: false, status: 'disconnected' };
  const engagement = snapshot.engagement ?? { connected: false, status: 'disconnected' };

  return { coreCrmId, coreCrm, workItems, engagement };
}

export function evaluateSetupReadiness(snapshot: IntegrationReadinessSnapshot): SetupReadiness {
  const { coreCrmId, coreCrm, workItems, engagement } = resolveSnapshot(snapshot);
  const coreEntry = getIntegrationCatalogEntry(coreCrmId);
  const coreCrmName = coreEntry?.name ?? 'CRM';
  const workItemsEntry = getIntegrationCatalogEntry('jira');
  const engagementEntry = getIntegrationCatalogEntry('slack');

  const blockers: SetupBlocker[] = [];
  const coreSyncing = coreCrm.status === 'syncing';

  if (!coreCrm.connected) {
    blockers.push({
      id: `${coreCrmId}-connect`,
      label: `Connect ${coreCrmName}`,
      why:
        coreEntry?.description ??
        'Import active implementation opportunities as trackable projects.',
      fixHref: '/integrations/setup',
      fixLabel: `Connect ${coreCrmName}`,
      required: true,
    });
  } else if (!coreCrm.lastSyncAt) {
    if (coreSyncing) {
      blockers.push({
        id: `${coreCrmId}-sync-running`,
        label: 'Initial sync in progress',
        why: `Beacon is importing opportunities from ${coreCrmName}. Your risk feed will unlock when this finishes.`,
        fixHref: '/integrations/setup',
        fixLabel: 'View sync status',
        required: true,
      });
    } else {
      blockers.push({
        id: `${coreCrmId}-sync`,
        label: `Run your first ${coreCrmName} sync`,
        why: 'Populate projects and baseline data before risk scoring can run.',
        fixHref: '/integrations/setup',
        fixLabel: 'Continue setup',
        required: true,
      });
    }
  }

  if (!workItems.connected) {
    const name = workItemsEntry?.name ?? 'Work tracker';
    blockers.push({
      id: 'work-items-connect',
      label: `Connect ${name}`,
      why:
        workItemsEntry?.description ??
        'Unlock blocked-work, dependency, and delivery-risk signals from your issue tracker.',
      fixHref: '/integrations/setup',
      fixLabel: `Connect ${name}`,
      required: false,
    });
  }

  if (!engagement.connected) {
    const name = engagementEntry?.name ?? 'Communication tool';
    blockers.push({
      id: 'engagement-connect',
      label: `Connect ${name}`,
      why:
        engagementEntry?.description ??
        'Detect customer response gaps and escalation patterns in project channels.',
      fixHref: '/integrations/setup',
      fixLabel: `Connect ${name}`,
      required: false,
    });
  }

  const unlinkedCount = snapshot.unlinkedJiraProjectCount ?? 0;
  if (workItems.connected && unlinkedCount > 0) {
    const name = workItemsEntry?.name ?? 'Work tracker';
    blockers.push({
      id: 'jira-unlinked-projects',
      label: `Link ${unlinkedCount} project${unlinkedCount === 1 ? '' : 's'} to ${name}`,
      why: 'Delivery risk signals need a Jira project mapping for each active implementation.',
      fixHref: '/integrations#jira',
      fixLabel: 'Map Jira projects',
      required: false,
    });
  }

  const orphanCount = snapshot.jiraOrphanProjectCount ?? 0;
  if (workItems.connected && orphanCount > 0) {
    blockers.push({
      id: 'jira-orphan-projects',
      label: `${orphanCount} unmapped ${orphanCount === 1 ? 'Jira project' : 'Jira projects'}`,
      why: 'Jira projects without a Beacon link will not feed task or dependency signals.',
      fixHref: '/integrations#jira',
      fixLabel: 'Review mappings',
      required: false,
    });
  }

  const requiredBlockers = blockers.filter((blocker) => blocker.required);
  const isReadyForCoreIntelligence = requiredBlockers.length === 0;
  const isFullyConnected =
    coreCrm.connected && workItems.connected && engagement.connected;
  const syncInProgress = Boolean(!coreCrm.lastSyncAt && coreSyncing);

  return {
    coreCrmId,
    coreCrmName,
    isReadyForCoreIntelligence,
    isFullyConnected,
    syncInProgress,
    syncProgress: coreCrm.syncProgress ?? undefined,
    blockers,
    nextBlocker: blockers[0] ?? null,
  };
}
