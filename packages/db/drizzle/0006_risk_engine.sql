ALTER TABLE "tenants" ADD COLUMN "risk_settings" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "risks" ADD COLUMN "rule_key" text;--> statement-breakpoint
ALTER TABLE "risks" ADD COLUMN "acknowledged_feedback" text;--> statement-breakpoint
CREATE INDEX "risks_rule_key_idx" ON "risks" USING btree ("tenant_id","project_id","rule_key");--> statement-breakpoint
CREATE TABLE "risk_evaluation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"trigger" text DEFAULT 'scheduled' NOT NULL,
	"status" "sync_job_status" DEFAULT 'pending' NOT NULL,
	"risks_created" integer DEFAULT 0 NOT NULL,
	"risks_updated" integer DEFAULT 0 NOT NULL,
	"risks_resolved" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk_evaluation_jobs" ADD CONSTRAINT "risk_evaluation_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_evaluation_jobs" ADD CONSTRAINT "risk_evaluation_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "risk_evaluation_jobs_tenant_id_idx" ON "risk_evaluation_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "risk_evaluation_jobs_project_id_idx" ON "risk_evaluation_jobs" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "risk_evaluation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_risk_evaluation_jobs" ON "risk_evaluation_jobs" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));
