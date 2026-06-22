export const APP_NAME = 'Beacon' as const;

export const REQUEST_ID_HEADER = 'x-request-id' as const;
export const TENANT_ID_HEADER = 'x-tenant-id' as const;

export const API_VERSION = 'v1' as const;

export const USER_ROLES = ['executive', 'operational', 'contributor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const INTEGRATION_SOURCES = [
  'salesforce',
  'hubspot',
  'microsoft_dynamics',
  'pipedrive',
  'jira',
  'linear',
  'slack',
  'google_calendar',
] as const;
export type IntegrationSource = (typeof INTEGRATION_SOURCES)[number];

export const INTEGRATION_STATUSES = [
  'connected',
  'degraded',
  'disconnected',
  'syncing',
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const RISK_STATUSES = ['open', 'acknowledged', 'resolved', 'snoozed'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const RECOMMENDATION_STATUSES = ['pending', 'accepted', 'dismissed'] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key' as const;

export const DEFAULT_PAGE_LIMIT = 20 as const;
export const MAX_PAGE_LIMIT = 100 as const;
