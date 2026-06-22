import type { IntegrationSource } from '../constants.js';

export type IntegrationCategory =
  | 'crm'
  | 'work_management'
  | 'communication'
  | 'calendar'
  | 'documentation';

export type IntegrationAvailability = 'available' | 'coming_soon' | 'beta';

/** How an integration participates in tenant setup and risk scoring. */
export type IntegrationSetupRole =
  | 'core_crm'
  | 'work_items'
  | 'engagement'
  | 'calendar'
  | 'optional';

export type IntegrationCatalogId = IntegrationSource | (string & {});

export type IntegrationCatalogEntry = {
  id: IntegrationCatalogId;
  name: string;
  category: IntegrationCategory;
  availability: IntegrationAvailability;
  setupRole: IntegrationSetupRole;
  description: string;
  /** Customer-facing value: what risk signals this integration unlocks. */
  signals: readonly string[];
  /** In-app anchor on the connections page. */
  anchor?: string;
  /** API path segment for OAuth/mock connect (e.g. salesforce, google-calendar). */
  connectPath?: string;
  sortOrder: number;
};

export const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  crm: 'CRM & revenue',
  work_management: 'Work management',
  communication: 'Communication',
  calendar: 'Calendar',
  documentation: 'Documentation',
};

/** Primary CRM used for core setup until tenant-level CRM preference exists. */
export const DEFAULT_CORE_CRM_ID = 'salesforce' as const;

export const INTEGRATION_CATALOG: readonly IntegrationCatalogEntry[] = [
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    availability: 'available',
    setupRole: 'core_crm',
    description: 'Import implementation opportunities, ARR, owners, and go-live dates.',
    signals: ['Portfolio projects', 'Revenue at risk', 'Owner accountability'],
    anchor: '#salesforce',
    connectPath: 'salesforce',
    sortOrder: 10,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    availability: 'available',
    setupRole: 'core_crm',
    description: 'Sync deals, companies, and implementation pipeline stages from HubSpot CRM.',
    signals: ['Deal pipeline', 'ARR tracking', 'Account ownership'],
    anchor: '#hubspot',
    connectPath: 'hubspot',
    sortOrder: 20,
  },
  {
    id: 'microsoft_dynamics',
    name: 'Microsoft Dynamics 365',
    category: 'crm',
    availability: 'available',
    setupRole: 'core_crm',
    description: 'Connect Dynamics opportunities and accounts for enterprise CRM workflows.',
    signals: ['Opportunity stages', 'Enterprise ARR', 'Account hierarchy'],
    anchor: '#microsoft-dynamics',
    connectPath: 'microsoft-dynamics',
    sortOrder: 30,
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    category: 'crm',
    availability: 'available',
    setupRole: 'core_crm',
    description: 'Import deals and organizations from Pipedrive for mid-market teams.',
    signals: ['Deal progress', 'Pipeline health'],
    anchor: '#pipedrive',
    connectPath: 'pipedrive',
    sortOrder: 40,
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'work_management',
    availability: 'available',
    setupRole: 'work_items',
    description: 'Import epics, stories, blocked work, and delivery dependencies.',
    signals: ['Blocked dependencies', 'Sprint drift', 'Delivery bottlenecks'],
    anchor: '#jira',
    connectPath: 'jira',
    sortOrder: 10,
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'work_management',
    availability: 'available',
    setupRole: 'work_items',
    description: 'Track issues, cycles, and project velocity from Linear.',
    signals: ['Issue blockers', 'Cycle risk'],
    anchor: '#linear',
    connectPath: 'linear',
    sortOrder: 20,
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'work_management',
    availability: 'coming_soon',
    setupRole: 'work_items',
    description: 'Sync tasks, milestones, and cross-team dependencies from Asana.',
    signals: ['Milestone slips', 'Task overload'],
    sortOrder: 30,
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    availability: 'available',
    setupRole: 'engagement',
    description: 'Monitor customer channels for response gaps and escalation patterns.',
    signals: ['Response delays', 'Engagement drops', 'Escalation risk'],
    anchor: '#slack',
    connectPath: 'slack',
    sortOrder: 10,
  },
  {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    category: 'communication',
    availability: 'coming_soon',
    setupRole: 'engagement',
    description: 'Track customer channel activity and meeting follow-ups in Teams.',
    signals: ['Response gaps', 'Channel silence'],
    sortOrder: 20,
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    category: 'calendar',
    availability: 'available',
    setupRole: 'calendar',
    description: 'Meeting frequency and stakeholder engagement context per project.',
    signals: ['Meeting load', 'Stakeholder engagement'],
    anchor: '#google-calendar',
    connectPath: 'google-calendar',
    sortOrder: 10,
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'documentation',
    availability: 'coming_soon',
    setupRole: 'optional',
    description: 'Link implementation playbooks and customer-facing docs to projects.',
    signals: ['Documentation gaps'],
    sortOrder: 10,
  },
] as const;

export function getIntegrationCatalogEntry(
  id: string,
): IntegrationCatalogEntry | undefined {
  return INTEGRATION_CATALOG.find((entry) => entry.id === id);
}

export function getAvailableIntegrations(): IntegrationCatalogEntry[] {
  return INTEGRATION_CATALOG.filter((entry) => entry.availability === 'available');
}

export function getComingSoonIntegrations(): IntegrationCatalogEntry[] {
  return INTEGRATION_CATALOG.filter((entry) => entry.availability === 'coming_soon');
}

export function getIntegrationsByCategory(
  category: IntegrationCategory,
): IntegrationCatalogEntry[] {
  return INTEGRATION_CATALOG.filter((entry) => entry.category === category).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function getCatalogCategories(): IntegrationCategory[] {
  const seen = new Set<IntegrationCategory>();
  for (const entry of INTEGRATION_CATALOG) {
    seen.add(entry.category);
  }
  return [...seen];
}

export function isConnectableCatalogEntry(
  entry: IntegrationCatalogEntry,
): entry is IntegrationCatalogEntry & { connectPath: string } {
  return (
    (entry.availability === 'available' || entry.availability === 'beta') &&
    Boolean(entry.connectPath)
  );
}

/** Maps catalog IDs to live API connect paths. Extend as new integrations ship. */
export const CATALOG_CONNECT_PATHS: Partial<Record<IntegrationCatalogId, string>> = {
  salesforce: 'salesforce',
  hubspot: 'hubspot',
  microsoft_dynamics: 'microsoft-dynamics',
  pipedrive: 'pipedrive',
  jira: 'jira',
  linear: 'linear',
  slack: 'slack',
  google_calendar: 'google-calendar',
};
