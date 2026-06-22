import { createDb, projects, withTenantContext } from '@beacon/db';
import { suggestChannelMappings, suggestProjectMappings } from '@beacon/shared';
import {
  AUTO_MAP_CONFIDENCE_THRESHOLD,
  getIntegrationCatalogEntry,
  listCoreCrmPreferenceOptions,
  type IntegrationCatalogId,
} from '@beacon/shared/integrations';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@beacon/db';
import { startGraphRebuild } from '../graph/builder.js';
import {
  getJiraIntegration,
  listJiraProjectMappings,
  upsertJiraProjectMapping,
} from '../jira/integration-service.js';
import { listAvailableJiraProjects } from '../jira/sync.js';
import {
  getLinearIntegration,
  listLinearTeamMappings,
  upsertLinearTeamMapping,
} from '../linear/integration-service.js';
import { listAvailableLinearTeams } from '../linear/sync.js';
import {
  getSlackIntegration,
  listSlackChannelMappings,
  upsertSlackChannelMapping,
} from '../slack/integration-service.js';
import { listAvailableSlackChannels } from '../slack/sync.js';
import {
  advanceCoreCrmSetup,
  getCoreCrmReadinessSnapshot,
} from './core-crm-resolver.js';
import { getTenantCoreCrmId } from './tenant-integration-settings.js';

export type SetupPhase =
  | 'connect_core_crm'
  | 'importing'
  | 'enhance_signals'
  | 'ready';

export type SetupState = {
  phase: SetupPhase;
  coreCrmId: IntegrationCatalogId;
  coreCrmName: string;
  coreCrmConnected: boolean;
  coreCrmSynced: boolean;
  syncInProgress: boolean;
  optionalConnected: number;
  optionalTotal: number;
  message: string;
  coreCrmOptions: ReturnType<typeof listCoreCrmPreferenceOptions>;
};

async function listGoliveProjects(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt))),
  );
}

export async function getSetupState(db: Database, tenantId: string): Promise<SetupState> {
  const coreCrmId = await getTenantCoreCrmId(db, tenantId);
  const coreEntry = getIntegrationCatalogEntry(coreCrmId);
  const { snapshot: coreCrm } = await getCoreCrmReadinessSnapshot(db, tenantId, coreCrmId);
  const jira = await getJiraIntegration(db, tenantId);
  const linear = await getLinearIntegration(db, tenantId);
  const slack = await getSlackIntegration(db, tenantId);

  const coreCrmConnected = coreCrm.connected;
  const coreCrmSynced = Boolean(coreCrm.lastSyncAt);
  const syncInProgress = coreCrm.status === 'syncing';

  const optionalTotal = 2;
  const workItemsConnected = Boolean(
    (jira && jira.status !== 'disconnected') || (linear && linear.status !== 'disconnected'),
  );
  const optionalConnected =
    (workItemsConnected ? 1 : 0) + (slack && slack.status !== 'disconnected' ? 1 : 0);

  const base = {
    coreCrmId,
    coreCrmName: coreEntry?.name ?? 'CRM',
    coreCrmOptions: listCoreCrmPreferenceOptions(),
  };

  if (!coreCrmConnected) {
    return {
      ...base,
      phase: 'connect_core_crm',
      coreCrmConnected: false,
      coreCrmSynced: false,
      syncInProgress: false,
      optionalConnected,
      optionalTotal,
      message: `Connect ${coreEntry?.name ?? 'your CRM'} to import implementation projects.`,
    };
  }

  if (!coreCrmSynced || syncInProgress) {
    return {
      ...base,
      phase: 'importing',
      coreCrmConnected: true,
      coreCrmSynced,
      syncInProgress,
      optionalConnected,
      optionalTotal,
      message: syncInProgress
        ? `Importing opportunities from ${coreEntry?.name ?? 'your CRM'}…`
        : 'Starting your first import…',
    };
  }

  if (optionalConnected < optionalTotal) {
    return {
      ...base,
      phase: 'enhance_signals',
      coreCrmConnected: true,
      coreCrmSynced: true,
      syncInProgress: false,
      optionalConnected,
      optionalTotal,
      message: 'Core setup is ready. Connect optional tools for richer risk signals.',
    };
  }

  return {
    ...base,
    phase: 'ready',
    coreCrmConnected: true,
    coreCrmSynced: true,
    syncInProgress: false,
    optionalConnected,
    optionalTotal,
    message: 'Setup complete. Your risk center is live.',
  };
}

export async function autoApplyJiraMappings(db: Database, tenantId: string): Promise<number> {
  const integration = await getJiraIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') return 0;

  const existing = await listJiraProjectMappings(db, tenantId, integration.id);
  const mappedProjectIds = new Set(existing.map((row) => row.internalId));
  const jiraProjects = await listAvailableJiraProjects(db, tenantId);
  const beaconProjects = await listGoliveProjects(db, tenantId);
  const suggestions = suggestProjectMappings(jiraProjects, beaconProjects).filter(
    (item) =>
      item.suggestedProjectId &&
      item.confidence >= AUTO_MAP_CONFIDENCE_THRESHOLD &&
      !mappedProjectIds.has(item.suggestedProjectId),
  );

  for (const suggestion of suggestions) {
    if (!suggestion.suggestedProjectId) continue;
    await upsertJiraProjectMapping(db, tenantId, integration.id, {
      internalId: suggestion.suggestedProjectId,
      externalId: suggestion.jiraProjectId,
      metadata: {
        jiraProjectKey: suggestion.jiraProjectName,
        jiraProjectName: suggestion.jiraProjectName,
        autoMapped: true,
      },
    });
    startGraphRebuild(db, tenantId, 'incremental', suggestion.suggestedProjectId);
    mappedProjectIds.add(suggestion.suggestedProjectId);
  }

  return suggestions.length;
}

export async function autoApplyLinearMappings(db: Database, tenantId: string): Promise<number> {
  const integration = await getLinearIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') return 0;

  const existing = await listLinearTeamMappings(db, tenantId, integration.id);
  const mappedProjectIds = new Set(existing.map((row) => row.internalId));
  const linearTeams = await listAvailableLinearTeams(db, tenantId);
  const beaconProjects = await listGoliveProjects(db, tenantId);
  const suggestions = suggestProjectMappings(
    linearTeams.map((team) => ({ id: team.id, key: team.key, name: team.name })),
    beaconProjects,
  ).filter(
    (item) =>
      item.suggestedProjectId &&
      item.confidence >= AUTO_MAP_CONFIDENCE_THRESHOLD &&
      !mappedProjectIds.has(item.suggestedProjectId),
  );

  for (const suggestion of suggestions) {
    if (!suggestion.suggestedProjectId) continue;
    const team = linearTeams.find((row) => row.id === suggestion.jiraProjectId);
    await upsertLinearTeamMapping(db, tenantId, integration.id, {
      internalId: suggestion.suggestedProjectId,
      externalId: suggestion.jiraProjectId,
      metadata: {
        linearTeamKey: team?.key,
        linearTeamName: suggestion.jiraProjectName,
        autoMapped: true,
      },
    });
    startGraphRebuild(db, tenantId, 'incremental', suggestion.suggestedProjectId);
    mappedProjectIds.add(suggestion.suggestedProjectId);
  }

  return suggestions.length;
}

export async function autoApplySlackMappings(db: Database, tenantId: string): Promise<number> {
  const integration = await getSlackIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') return 0;

  const existing = await listSlackChannelMappings(db, tenantId, integration.id);
  const mappedProjectIds = new Set(existing.map((row) => row.internalId));
  const channels = await listAvailableSlackChannels(db, tenantId);
  const beaconProjects = await listGoliveProjects(db, tenantId);
  const suggestions = suggestChannelMappings(channels, beaconProjects).filter(
    (item) =>
      item.suggestedProjectId &&
      item.confidence >= AUTO_MAP_CONFIDENCE_THRESHOLD &&
      item.botPresent &&
      !mappedProjectIds.has(item.suggestedProjectId),
  );

  for (const suggestion of suggestions) {
    if (!suggestion.suggestedProjectId) continue;
    await upsertSlackChannelMapping(db, tenantId, integration.id, {
      internalId: suggestion.suggestedProjectId,
      externalId: suggestion.channelId,
      metadata: {
        channelName: suggestion.channelName,
        botPresent: suggestion.botPresent,
        autoMapped: true,
      },
    });
    mappedProjectIds.add(suggestion.suggestedProjectId);
  }

  return suggestions.length;
}

export type AdvanceSetupResult = SetupState & {
  actionsTaken: string[];
};

export async function advanceSetup(db: Database, tenantId: string): Promise<AdvanceSetupResult> {
  const actionsTaken = await advanceCoreCrmSetup(db, tenantId);

  const jiraMapped = await autoApplyJiraMappings(db, tenantId);
  if (jiraMapped > 0) {
    actionsTaken.push(`Auto-mapped ${jiraMapped} Jira project${jiraMapped === 1 ? '' : 's'}`);
  }

  const linearMapped = await autoApplyLinearMappings(db, tenantId);
  if (linearMapped > 0) {
    actionsTaken.push(`Auto-mapped ${linearMapped} Linear team${linearMapped === 1 ? '' : 's'}`);
  }

  const slackMapped = await autoApplySlackMappings(db, tenantId);
  if (slackMapped > 0) {
    actionsTaken.push(`Auto-mapped ${slackMapped} Slack channel${slackMapped === 1 ? '' : 's'}`);
  }

  const state = await getSetupState(db, tenantId);
  return { ...state, actionsTaken };
}
