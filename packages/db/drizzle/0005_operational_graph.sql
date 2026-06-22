CREATE TYPE "public"."entity_link_type" AS ENUM('owner', 'customer_account', 'project_mapping');--> statement-breakpoint
CREATE TYPE "public"."entity_resolution_method" AS ENUM('auto_email', 'manual', 'fuzzy');--> statement-breakpoint
CREATE TYPE "public"."graph_rebuild_type" AS ENUM('full', 'incremental');--> statement-breakpoint
CREATE TYPE "public"."graph_node_type" AS ENUM('customer', 'project', 'milestone', 'task', 'owner', 'revenue');--> statement-breakpoint
CREATE TYPE "public"."graph_edge_type" AS ENUM('contains', 'assigned_to', 'blocks', 'has_revenue', 'maps_to');--> statement-breakpoint

CREATE TABLE "entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"link_type" "entity_link_type" NOT NULL,
	"canonical_key" text NOT NULL,
	"source" "integration_source",
	"external_id" text,
	"internal_entity_id" uuid,
	"display_name" text,
	"email" text,
	"confidence" integer DEFAULT 100 NOT NULL,
	"resolution_method" "entity_resolution_method" DEFAULT 'auto_email' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "graph_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"from_node_type" "graph_node_type" NOT NULL,
	"from_node_id" text NOT NULL,
	"to_node_type" "graph_node_type" NOT NULL,
	"to_node_id" text NOT NULL,
	"edge_type" "graph_edge_type" NOT NULL,
	"project_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"rebuilt_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "graph_rebuild_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rebuild_type" "graph_rebuild_type" NOT NULL,
	"status" "sync_job_status" DEFAULT 'pending' NOT NULL,
	"edges_built" integer DEFAULT 0 NOT NULL,
	"entities_resolved" integer DEFAULT 0 NOT NULL,
	"project_id" uuid,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_rebuild_jobs" ADD CONSTRAINT "graph_rebuild_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_rebuild_jobs" ADD CONSTRAINT "graph_rebuild_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_links_tenant_id_idx" ON "entity_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "entity_links_canonical_key_idx" ON "entity_links" USING btree ("tenant_id","canonical_key");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_links_unique_idx" ON "entity_links" USING btree ("tenant_id","link_type","canonical_key","source","external_id");--> statement-breakpoint
CREATE INDEX "graph_edges_tenant_id_idx" ON "graph_edges" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "graph_edges_project_id_idx" ON "graph_edges" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "graph_edges_from_idx" ON "graph_edges" USING btree ("tenant_id","from_node_type","from_node_id");--> statement-breakpoint
CREATE INDEX "graph_edges_to_idx" ON "graph_edges" USING btree ("tenant_id","to_node_type","to_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "graph_edges_unique_idx" ON "graph_edges" USING btree ("tenant_id","from_node_type","from_node_id","to_node_type","to_node_id","edge_type");--> statement-breakpoint
CREATE INDEX "graph_rebuild_jobs_tenant_id_idx" ON "graph_rebuild_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "graph_rebuild_jobs_project_id_idx" ON "graph_rebuild_jobs" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "entity_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "graph_edges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "graph_rebuild_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_entity_links" ON "entity_links" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_graph_edges" ON "graph_edges" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_graph_rebuild_jobs" ON "graph_rebuild_jobs" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));
