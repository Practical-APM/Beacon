import {
  DEFAULT_CORE_CRM_ID,
  getIntegrationCatalogEntry,
  getIntegrationsByCategory,
  type IntegrationCatalogId,
  type IntegrationSetupRole,
} from './catalog.js';

export type SetupWizardStepKind = 'connect' | 'mapping' | 'sync';

export type SetupWizardStep = {
  id: string;
  catalogId: IntegrationCatalogId;
  label: string;
  short: string;
  kind: SetupWizardStepKind;
  setupRole: IntegrationSetupRole;
  required: boolean;
  description: string;
  anchor?: string;
};

function firstAvailableByRole(role: IntegrationSetupRole) {
  return INTEGRATION_CATALOG_BY_ROLE.get(role);
}

const INTEGRATION_CATALOG_BY_ROLE = new Map<IntegrationSetupRole, ReturnType<typeof getIntegrationCatalogEntry>>();

for (const role of ['core_crm', 'work_items', 'engagement'] as const) {
  const match =
    role === 'core_crm'
      ? getIntegrationCatalogEntry(DEFAULT_CORE_CRM_ID)
      : getIntegrationsByCategory(
          role === 'work_items' ? 'work_management' : 'communication',
        ).find((entry) => entry.availability === 'available' && entry.setupRole === role);
  if (match) INTEGRATION_CATALOG_BY_ROLE.set(role, match);
}

/** Default guided setup steps for a tenant's chosen core CRM. */
export function getDefaultSetupWizardSteps(
  coreCrmId: IntegrationCatalogId = DEFAULT_CORE_CRM_ID,
): SetupWizardStep[] {
  const core = getIntegrationCatalogEntry(coreCrmId) ?? getIntegrationCatalogEntry(DEFAULT_CORE_CRM_ID);
  const workItems = firstAvailableByRole('work_items');
  const engagement = firstAvailableByRole('engagement');

  if (!core) return [];

  const steps: SetupWizardStep[] = [
    {
      id: 'core_crm',
      catalogId: core.id,
      label: `Connect ${core.name}`,
      short: core.name,
      kind: 'connect',
      setupRole: 'core_crm',
      required: true,
      description: core.description,
      anchor: core.anchor,
    },
  ];

  if (workItems) {
    steps.push({
      id: workItems.id,
      catalogId: workItems.id,
      label: `Connect ${workItems.name}`,
      short: workItems.name,
      kind: 'connect',
      setupRole: 'work_items',
      required: false,
      description: workItems.description,
      anchor: workItems.anchor,
    });
  }

  if (engagement) {
    steps.push({
      id: engagement.id,
      catalogId: engagement.id,
      label: `Connect ${engagement.name}`,
      short: engagement.name,
      kind: 'connect',
      setupRole: 'engagement',
      required: false,
      description: engagement.description,
      anchor: engagement.anchor,
    });
  }

  steps.push({
    id: 'sync',
    catalogId: core.id,
    label: 'Sync and launch',
    short: 'Launch',
    kind: 'sync',
    setupRole: 'core_crm',
    required: true,
    description: `Run an initial ${core.name} sync, then open the Implementation Risk Center dashboard.`,
    anchor: core.anchor,
  });

  return steps;
}

export const DEFAULT_SETUP_WIZARD_STEPS = getDefaultSetupWizardSteps(DEFAULT_CORE_CRM_ID);
