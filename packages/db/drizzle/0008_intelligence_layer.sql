CREATE TYPE "public"."insight_source" AS ENUM('llm', 'template', 'cached');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "intelligence_settings" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
CREATE TABLE "project_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"risk_id" uuid,
	"root_cause" text NOT NULL,
	"recommended_action" text NOT NULL,
	"suggested_owner" text,
	"escalation_path" text,
	"confidence" integer NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_hash" text NOT NULL,
	"source" "insight_source" DEFAULT 'template' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"tokens_used" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_insights" ADD CONSTRAINT "project_insights_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_insights" ADD CONSTRAINT "project_insights_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_insights" ADD CONSTRAINT "project_insights_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_insights_tenant_id_idx" ON "project_insights" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_insights_project_id_idx" ON "project_insights" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_insights_risk_id_idx" ON "project_insights" USING btree ("risk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_insights_risk_unique_idx" ON "project_insights" USING btree ("tenant_id","risk_id");--> statement-breakpoint
ALTER TABLE "project_insights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_project_insights" ON "project_insights" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));
