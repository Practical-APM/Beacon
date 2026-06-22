CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('open', 'acknowledged', 'resolved', 'snoozed');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('pending', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."mapping_type" AS ENUM('project_to_jira', 'project_to_slack_channel', 'salesforce_field', 'customer_to_account');--> statement-breakpoint

CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"external_id" text,
	"external_source" "integration_source",
	"name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"external_id" text,
	"external_source" "integration_source",
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"status_category" text DEFAULT 'todo' NOT NULL,
	"assignee_name" text,
	"assignee_email" text,
	"due_date" timestamp with time zone,
	"is_critical" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"event_schema_version" integer DEFAULT 1 NOT NULL,
	"event_type" text NOT NULL,
	"source" "integration_source" NOT NULL,
	"external_id" text,
	"external_event_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"level" "risk_level" NOT NULL,
	"status" "risk_status" DEFAULT 'open' NOT NULL,
	"score" integer NOT NULL,
	"reason" text NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb,
	"predicted_delay_days" integer,
	"snoozed_until" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"risk_id" uuid,
	"suggested_owner" text,
	"suggested_action" text NOT NULL,
	"escalation_path" text,
	"status" "recommendation_status" DEFAULT 'pending' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "integration_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"mapping_type" "mapping_type" NOT NULL,
	"internal_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);--> statement-breakpoint

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "owner_email_idx_placeholder" text;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "owner_email_idx_placeholder";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_owner_email_idx" ON "projects" USING btree ("owner_email");--> statement-breakpoint

ALTER TABLE "milestones" ADD CONSTRAINT "milestones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "milestones_tenant_id_idx" ON "milestones" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "milestones_project_id_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "milestones_tenant_external_idx" ON "milestones" USING btree ("tenant_id","external_source","external_id");--> statement-breakpoint
CREATE INDEX "tasks_tenant_id_idx" ON "tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_milestone_id_idx" ON "tasks" USING btree ("milestone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_tenant_external_idx" ON "tasks" USING btree ("tenant_id","external_source","external_id");--> statement-breakpoint
CREATE INDEX "events_tenant_id_idx" ON "events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "events_project_id_idx" ON "events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "events_occurred_at_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_tenant_dedup_idx" ON "events" USING btree ("tenant_id","source","external_event_id");--> statement-breakpoint
CREATE INDEX "risks_tenant_id_idx" ON "risks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "risks_project_id_idx" ON "risks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "risks_status_idx" ON "risks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "risks_level_idx" ON "risks" USING btree ("level");--> statement-breakpoint
CREATE INDEX "recommendations_tenant_id_idx" ON "recommendations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recommendations_project_id_idx" ON "recommendations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "recommendations_risk_id_idx" ON "recommendations" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "integration_mappings_tenant_id_idx" ON "integration_mappings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "integration_mappings_integration_id_idx" ON "integration_mappings" USING btree ("integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_mappings_unique_idx" ON "integration_mappings" USING btree ("tenant_id","integration_id","mapping_type","internal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_tenant_key_idx" ON "idempotency_keys" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint

ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "risks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "tenant_isolation_milestones" ON "milestones" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_tasks" ON "tasks" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_events" ON "events" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_risks" ON "risks" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_recommendations" ON "recommendations" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_integration_mappings" ON "integration_mappings" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_idempotency_keys" ON "idempotency_keys" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));
