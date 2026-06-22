CREATE TYPE "public"."sync_job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sync_job_type" AS ENUM('bulk', 'incremental');--> statement-breakpoint

CREATE TABLE "integration_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"job_type" "sync_job_type" NOT NULL,
	"status" "sync_job_status" DEFAULT 'pending' NOT NULL,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_total" integer,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_sync_jobs_tenant_id_idx" ON "integration_sync_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "integration_sync_jobs_integration_id_idx" ON "integration_sync_jobs" USING btree ("integration_id");--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_integration_sync_jobs" ON "integration_sync_jobs" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));
