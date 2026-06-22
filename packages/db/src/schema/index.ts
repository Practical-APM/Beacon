import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'executive',
  'operational',
  'contributor',
  'admin',
]);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'on_hold',
  'completed',
  'cancelled',
]);

export const integrationSourceEnum = pgEnum('integration_source', [
  'salesforce',
  'hubspot',
  'microsoft_dynamics',
  'pipedrive',
  'jira',
  'linear',
  'slack',
  'google_calendar',
]);

export const integrationStatusEnum = pgEnum('integration_status', [
  'connected',
  'degraded',
  'disconnected',
  'syncing',
]);

export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high', 'critical']);

export const riskStatusEnum = pgEnum('risk_status', [
  'open',
  'acknowledged',
  'resolved',
  'snoozed',
]);

export const recommendationStatusEnum = pgEnum('recommendation_status', [
  'pending',
  'accepted',
  'dismissed',
]);

export const mappingTypeEnum = pgEnum('mapping_type', [
  'project_to_jira',
  'project_to_linear',
  'project_to_slack_channel',
  'project_to_calendar',
  'salesforce_field',
  'customer_to_account',
]);

export const syncJobStatusEnum = pgEnum('sync_job_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const syncJobTypeEnum = pgEnum('sync_job_type', ['bulk', 'incremental']);

export const entityLinkTypeEnum = pgEnum('entity_link_type', [
  'owner',
  'customer_account',
  'project_mapping',
]);

export const entityResolutionMethodEnum = pgEnum('entity_resolution_method', [
  'auto_email',
  'manual',
  'fuzzy',
]);

export const graphRebuildTypeEnum = pgEnum('graph_rebuild_type', ['full', 'incremental']);

export const graphNodeTypeEnum = pgEnum('graph_node_type', [
  'customer',
  'project',
  'milestone',
  'task',
  'owner',
  'revenue',
]);

export const graphEdgeTypeEnum = pgEnum('graph_edge_type', [
  'contains',
  'assigned_to',
  'blocks',
  'has_revenue',
  'maps_to',
]);

export const insightSourceEnum = pgEnum('insight_source', ['llm', 'template', 'cached']);

export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'slack', 'in_app']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'daily_digest',
  'immediate_alert',
  'system',
]);

export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', [
  'sent',
  'failed',
  'skipped',
  'bounced',
]);

export const auditActionEnum = pgEnum('audit_action', [
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
]);

export const feedbackRatingEnum = pgEnum('feedback_rating', ['helpful', 'not_helpful']);

export const feedbackTargetTypeEnum = pgEnum('feedback_target_type', [
  'insight',
  'recommendation',
]);

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending',
  'delivered',
  'failed',
]);

export const deletionRequestStatusEnum = pgEnum('deletion_request_status', [
  'pending',
  'processing',
  'completed',
  'rejected',
]);

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    externalOrgId: text('external_org_id'),
    riskSettings: jsonb('risk_settings').$type<Record<string, unknown>>().default({}),
    intelligenceSettings: jsonb('intelligence_settings').$type<Record<string, unknown>>().default({}),
    notificationSettings: jsonb('notification_settings').$type<Record<string, unknown>>().default({}),
    integrationSettings: jsonb('integration_settings').$type<Record<string, unknown>>().default({}),
    featureFlags: jsonb('feature_flags').$type<Record<string, unknown>>().default({}),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('tenants_external_org_id_idx').on(table.externalOrgId)],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalAuthId: text('external_auth_id').notNull(),
    email: text('email').notNull(),
    name: text('name'),
    timezone: text('timezone').default('UTC'),
    locale: text('locale').notNull().default('en'),
    currencyFormatLocale: text('currency_format_locale').notNull().default('en-US'),
    emailValid: boolean('email_valid').notNull().default(true),
    globalSnoozeUntil: timestamp('global_snooze_until', { withTimezone: true }),
    unsubscribeToken: text('unsubscribe_token'),
    dpaAcceptedAt: timestamp('dpa_accepted_at', { withTimezone: true }),
    dpaVersion: text('dpa_version'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_external_auth_id_idx').on(table.externalAuthId),
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_unsubscribe_token_idx').on(table.unsubscribeToken),
  ],
);

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull().default('contributor'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tenant_memberships_tenant_id_idx').on(table.tenantId),
    index('tenant_memberships_user_id_idx').on(table.userId),
    uniqueIndex('tenant_memberships_tenant_user_idx').on(table.tenantId, table.userId),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: userRoleEnum('role').notNull().default('contributor'),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    token: text('token').notNull(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('invitations_tenant_id_idx').on(table.tenantId),
    uniqueIndex('invitations_token_idx').on(table.token),
    index('invitations_email_idx').on(table.email),
  ],
);

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    source: integrationSourceEnum('source').notNull(),
    status: integrationStatusEnum('status').notNull().default('disconnected'),
    externalOrgId: text('external_org_id'),
    credentialsEncrypted: text('credentials_encrypted'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integrations_tenant_id_idx').on(table.tenantId),
    uniqueIndex('integrations_tenant_source_idx').on(table.tenantId, table.source),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    externalSource: integrationSourceEnum('external_source').notNull().default('salesforce'),
    name: text('name').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('customers_tenant_id_idx').on(table.tenantId),
    uniqueIndex('customers_tenant_external_idx').on(
      table.tenantId,
      table.externalSource,
      table.externalId,
    ),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    externalSource: integrationSourceEnum('external_source'),
    name: text('name').notNull(),
    status: projectStatusEnum('status').notNull().default('active'),
    targetGoLiveDate: timestamp('target_go_live_date', { withTimezone: true }),
    arrAmount: integer('arr_amount'),
    arrCurrency: text('arr_currency').default('USD'),
    ownerName: text('owner_name'),
    ownerEmail: text('owner_email'),
    dataComplete: boolean('data_complete').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('projects_tenant_id_idx').on(table.tenantId),
    index('projects_customer_id_idx').on(table.customerId),
    index('projects_status_idx').on(table.status),
    index('projects_owner_email_idx').on(table.ownerEmail),
  ],
);

export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    externalSource: integrationSourceEnum('external_source'),
    name: text('name').notNull(),
    status: text('status').notNull().default('open'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('milestones_tenant_id_idx').on(table.tenantId),
    index('milestones_project_id_idx').on(table.projectId),
    uniqueIndex('milestones_tenant_external_idx').on(
      table.tenantId,
      table.externalSource,
      table.externalId,
    ),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
    externalId: text('external_id'),
    externalSource: integrationSourceEnum('external_source'),
    title: text('title').notNull(),
    status: text('status').notNull().default('open'),
    statusCategory: text('status_category').notNull().default('todo'),
    assigneeName: text('assignee_name'),
    assigneeEmail: text('assignee_email'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    priority: text('priority'),
    labels: jsonb('labels').$type<string[]>().default([]),
    isCritical: boolean('is_critical').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tasks_tenant_id_idx').on(table.tenantId),
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_milestone_id_idx').on(table.milestoneId),
    uniqueIndex('tasks_tenant_external_idx').on(
      table.tenantId,
      table.externalSource,
      table.externalId,
    ),
  ],
);

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    dependsOnTaskId: uuid('depends_on_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    linkType: text('link_type').notNull().default('blocks'),
    externalLinkId: text('external_link_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('task_dependencies_tenant_id_idx').on(table.tenantId),
    index('task_dependencies_task_id_idx').on(table.taskId),
    index('task_dependencies_depends_on_task_id_idx').on(table.dependsOnTaskId),
    uniqueIndex('task_dependencies_unique_idx').on(
      table.tenantId,
      table.taskId,
      table.dependsOnTaskId,
    ),
  ],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    eventSchemaVersion: integer('event_schema_version').notNull().default(1),
    eventType: text('event_type').notNull(),
    source: integrationSourceEnum('source').notNull(),
    externalId: text('external_id'),
    externalEventId: text('external_event_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_tenant_id_idx').on(table.tenantId),
    index('events_project_id_idx').on(table.projectId),
    index('events_occurred_at_idx').on(table.occurredAt),
    uniqueIndex('events_tenant_dedup_idx').on(
      table.tenantId,
      table.source,
      table.externalEventId,
    ),
  ],
);

export const risks = pgTable(
  'risks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    level: riskLevelEnum('level').notNull(),
    status: riskStatusEnum('status').notNull().default('open'),
    score: integer('score').notNull(),
    reason: text('reason').notNull(),
    ruleKey: text('rule_key'),
    confidence: integer('confidence').notNull().default(50),
    evidence: jsonb('evidence').$type<Record<string, unknown>[]>().default([]),
    predictedDelayDays: integer('predicted_delay_days'),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedFeedback: text('acknowledged_feedback'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('risks_tenant_id_idx').on(table.tenantId),
    index('risks_project_id_idx').on(table.projectId),
    index('risks_status_idx').on(table.status),
    index('risks_level_idx').on(table.level),
    index('risks_rule_key_idx').on(table.tenantId, table.projectId, table.ruleKey),
  ],
);

export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    riskId: uuid('risk_id').references(() => risks.id, { onDelete: 'set null' }),
    suggestedOwner: text('suggested_owner'),
    suggestedAction: text('suggested_action').notNull(),
    escalationPath: text('escalation_path'),
    status: recommendationStatusEnum('status').notNull().default('pending'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('recommendations_tenant_id_idx').on(table.tenantId),
    index('recommendations_project_id_idx').on(table.projectId),
    index('recommendations_risk_id_idx').on(table.riskId),
  ],
);

export const integrationMappings = pgTable(
  'integration_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    mappingType: mappingTypeEnum('mapping_type').notNull(),
    internalId: uuid('internal_id').notNull(),
    externalId: text('external_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_mappings_tenant_id_idx').on(table.tenantId),
    index('integration_mappings_integration_id_idx').on(table.integrationId),
    uniqueIndex('integration_mappings_unique_idx').on(
      table.tenantId,
      table.integrationId,
      table.mappingType,
      table.externalId,
    ),
  ],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('idempotency_keys_tenant_key_idx').on(table.tenantId, table.key),
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  ],
);

export const integrationSyncJobs = pgTable(
  'integration_sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    jobType: syncJobTypeEnum('job_type').notNull(),
    status: syncJobStatusEnum('status').notNull().default('pending'),
    recordsProcessed: integer('records_processed').notNull().default(0),
    recordsTotal: integer('records_total'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_sync_jobs_tenant_id_idx').on(table.tenantId),
    index('integration_sync_jobs_integration_id_idx').on(table.integrationId),
  ],
);

export const entityLinks = pgTable(
  'entity_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    linkType: entityLinkTypeEnum('link_type').notNull(),
    canonicalKey: text('canonical_key').notNull(),
    source: integrationSourceEnum('source'),
    externalId: text('external_id'),
    internalEntityId: uuid('internal_entity_id'),
    displayName: text('display_name'),
    email: text('email'),
    confidence: integer('confidence').notNull().default(100),
    resolutionMethod: entityResolutionMethodEnum('resolution_method')
      .notNull()
      .default('auto_email'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('entity_links_tenant_id_idx').on(table.tenantId),
    index('entity_links_canonical_key_idx').on(table.tenantId, table.canonicalKey),
    uniqueIndex('entity_links_unique_idx').on(
      table.tenantId,
      table.linkType,
      table.canonicalKey,
      table.source,
      table.externalId,
    ),
  ],
);

export const graphEdges = pgTable(
  'graph_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    fromNodeType: graphNodeTypeEnum('from_node_type').notNull(),
    fromNodeId: text('from_node_id').notNull(),
    toNodeType: graphNodeTypeEnum('to_node_type').notNull(),
    toNodeId: text('to_node_id').notNull(),
    edgeType: graphEdgeTypeEnum('edge_type').notNull(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    rebuiltAt: timestamp('rebuilt_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('graph_edges_tenant_id_idx').on(table.tenantId),
    index('graph_edges_project_id_idx').on(table.projectId),
    index('graph_edges_from_idx').on(table.tenantId, table.fromNodeType, table.fromNodeId),
    index('graph_edges_to_idx').on(table.tenantId, table.toNodeType, table.toNodeId),
    uniqueIndex('graph_edges_unique_idx').on(
      table.tenantId,
      table.fromNodeType,
      table.fromNodeId,
      table.toNodeType,
      table.toNodeId,
      table.edgeType,
    ),
  ],
);

export const graphRebuildJobs = pgTable(
  'graph_rebuild_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    rebuildType: graphRebuildTypeEnum('rebuild_type').notNull(),
    status: syncJobStatusEnum('status').notNull().default('pending'),
    edgesBuilt: integer('edges_built').notNull().default(0),
    entitiesResolved: integer('entities_resolved').notNull().default(0),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('graph_rebuild_jobs_tenant_id_idx').on(table.tenantId),
    index('graph_rebuild_jobs_project_id_idx').on(table.projectId),
  ],
);

export const riskEvaluationJobs = pgTable(
  'risk_evaluation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    trigger: text('trigger').notNull().default('scheduled'),
    status: syncJobStatusEnum('status').notNull().default('pending'),
    risksCreated: integer('risks_created').notNull().default(0),
    risksUpdated: integer('risks_updated').notNull().default(0),
    risksResolved: integer('risks_resolved').notNull().default(0),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('risk_evaluation_jobs_tenant_id_idx').on(table.tenantId),
    index('risk_evaluation_jobs_project_id_idx').on(table.projectId),
  ],
);

export const slackChannelSignals = pgTable(
  'slack_channel_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    mappingId: uuid('mapping_id')
      .notNull()
      .references(() => integrationMappings.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull(),
    channelName: text('channel_name'),
    botPresent: boolean('bot_present').notNull().default(false),
    botAccessError: text('bot_access_error'),
    lastCustomerMessageAt: timestamp('last_customer_message_at', { withTimezone: true }),
    lastInternalResponseAt: timestamp('last_internal_response_at', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    lastEscalationAt: timestamp('last_escalation_at', { withTimezone: true }),
    messageSampleCount: integer('message_sample_count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    stale: boolean('stale').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('slack_channel_signals_tenant_id_idx').on(table.tenantId),
    index('slack_channel_signals_project_id_idx').on(table.projectId),
    uniqueIndex('slack_channel_signals_channel_idx').on(table.tenantId, table.channelId),
  ],
);

export const calendarProjectSignals = pgTable(
  'calendar_project_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    mappingId: uuid('mapping_id')
      .notNull()
      .references(() => integrationMappings.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    calendarId: text('calendar_id').notNull(),
    calendarName: text('calendar_name'),
    lastMeetingAt: timestamp('last_meeting_at', { withTimezone: true }),
    lastCustomerMeetingAt: timestamp('last_customer_meeting_at', { withTimezone: true }),
    meetingCount30d: integer('meeting_count_30d').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    stale: boolean('stale').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('calendar_project_signals_tenant_id_idx').on(table.tenantId),
    index('calendar_project_signals_project_id_idx').on(table.projectId),
    uniqueIndex('calendar_project_signals_calendar_idx').on(table.tenantId, table.calendarId),
  ],
);

export const projectInsights = pgTable(
  'project_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    riskId: uuid('risk_id').references(() => risks.id, { onDelete: 'cascade' }),
    rootCause: text('root_cause').notNull(),
    recommendedAction: text('recommended_action').notNull(),
    suggestedOwner: text('suggested_owner'),
    escalationPath: text('escalation_path'),
    confidence: integer('confidence').notNull(),
    evidence: jsonb('evidence').$type<Record<string, unknown>[]>().notNull().default([]),
    evidenceHash: text('evidence_hash').notNull(),
    source: insightSourceEnum('source').notNull().default('template'),
    locale: text('locale').notNull().default('en'),
    tokensUsed: integer('tokens_used'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('project_insights_tenant_id_idx').on(table.tenantId),
    index('project_insights_project_id_idx').on(table.projectId),
    index('project_insights_risk_id_idx').on(table.riskId),
    uniqueIndex('project_insights_risk_unique_idx').on(table.tenantId, table.riskId),
  ],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    slackEnabled: boolean('slack_enabled').notNull().default(false),
    frequency: text('frequency').notNull().default('daily'),
    minSeverity: riskLevelEnum('min_severity').notNull().default('high'),
    minConfidence: integer('min_confidence').notNull().default(60),
    digestHourLocal: integer('digest_hour_local').notNull().default(8),
    lastDigestSentAt: timestamp('last_digest_sent_at', { withTimezone: true }),
    unsubscribedTypes: jsonb('unsubscribed_types').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_preferences_tenant_user_idx').on(table.tenantId, table.userId),
    index('notification_preferences_tenant_id_idx').on(table.tenantId),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_tenant_user_idx').on(table.tenantId, table.userId),
    index('notifications_user_unread_idx').on(table.userId, table.readAt),
  ],
);

export const notificationDeliveryLog = pgTable(
  'notification_delivery_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    riskId: uuid('risk_id').references(() => risks.id, { onDelete: 'set null' }),
    channel: notificationChannelEnum('channel').notNull(),
    notificationType: notificationTypeEnum('notification_type').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    status: notificationDeliveryStatusEnum('status').notNull().default('sent'),
    error: text('error'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_delivery_dedupe_idx').on(table.tenantId, table.dedupeKey),
    index('notification_delivery_risk_idx').on(table.riskId, table.sentAt),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: auditActionEnum('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_events_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('audit_events_tenant_action_idx').on(table.tenantId, table.action),
  ],
);

export const deletionRequests = pgTable(
  'deletion_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: deletionRequestStatusEnum('status').notNull().default('pending'),
    notes: text('notes'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('deletion_requests_tenant_status_idx').on(table.tenantId, table.status),
    index('deletion_requests_user_idx').on(table.userId, table.requestedAt),
  ],
);

export const webhookSubscriptions = pgTable(
  'webhook_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    eventTypes: jsonb('event_types').$type<string[]>().notNull().default([
      'risk.created',
      'risk.updated',
      'risk.escalated',
      'risk.resolved',
    ]),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('webhook_subscriptions_tenant_idx').on(table.tenantId, table.enabled)],
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    eventId: text('event_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: webhookDeliveryStatusEnum('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('webhook_deliveries_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('webhook_deliveries_subscription_idx').on(table.subscriptionId, table.createdAt),
  ],
);

export const recommendationFeedback = pgTable(
  'recommendation_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    riskId: uuid('risk_id').references(() => risks.id, { onDelete: 'set null' }),
    insightId: uuid('insight_id').references(() => projectInsights.id, { onDelete: 'set null' }),
    recommendationId: uuid('recommendation_id').references(() => recommendations.id, {
      onDelete: 'set null',
    }),
    targetType: feedbackTargetTypeEnum('target_type').notNull(),
    rating: feedbackRatingEnum('rating').notNull(),
    comment: text('comment'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('recommendation_feedback_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('recommendation_feedback_project_idx').on(table.projectId, table.createdAt),
  ],
);

export const tenantBenchmarkSnapshots = pgTable(
  'tenant_benchmark_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    snapshotDate: date('snapshot_date').notNull(),
    activeProjects: integer('active_projects').notNull().default(0),
    atRiskProjects: integer('at_risk_projects').notNull().default(0),
    openRisks: integer('open_risks').notNull().default(0),
    avgRiskScore: numeric('avg_risk_score', { precision: 8, scale: 2 }),
    avgDaysToGoLive: numeric('avg_days_to_go_live', { precision: 8, scale: 2 }),
    atRiskRate: numeric('at_risk_rate', { precision: 8, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tenant_benchmark_snapshots_tenant_date_idx').on(
      table.tenantId,
      table.snapshotDate,
    ),
    index('tenant_benchmark_snapshots_date_idx').on(table.snapshotDate),
  ],
);

export const benchmarkCohortMetrics = pgTable(
  'benchmark_cohort_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    snapshotDate: date('snapshot_date').notNull(),
    cohort: text('cohort').notNull().default('all'),
    metricKey: text('metric_key').notNull(),
    sampleTenants: integer('sample_tenants').notNull().default(0),
    p25: numeric('p25', { precision: 8, scale: 2 }),
    p50: numeric('p50', { precision: 8, scale: 2 }),
    p75: numeric('p75', { precision: 8, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('benchmark_cohort_metrics_unique_idx').on(
      table.snapshotDate,
      table.cohort,
      table.metricKey,
    ),
    index('benchmark_cohort_metrics_date_idx').on(table.snapshotDate, table.cohort),
  ],
);
