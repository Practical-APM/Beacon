CREATE TABLE "tenant_benchmark_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"active_projects" integer DEFAULT 0 NOT NULL,
	"at_risk_projects" integer DEFAULT 0 NOT NULL,
	"open_risks" integer DEFAULT 0 NOT NULL,
	"avg_risk_score" numeric(8, 2),
	"avg_days_to_go_live" numeric(8, 2),
	"at_risk_rate" numeric(8, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "benchmark_cohort_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" date NOT NULL,
	"cohort" text DEFAULT 'all' NOT NULL,
	"metric_key" text NOT NULL,
	"sample_tenants" integer DEFAULT 0 NOT NULL,
	"p25" numeric(8, 2),
	"p50" numeric(8, 2),
	"p75" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "tenant_benchmark_snapshots" ADD CONSTRAINT "tenant_benchmark_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_benchmark_snapshots_tenant_date_idx" ON "tenant_benchmark_snapshots" USING btree ("tenant_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "tenant_benchmark_snapshots_date_idx" ON "tenant_benchmark_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "benchmark_cohort_metrics_unique_idx" ON "benchmark_cohort_metrics" USING btree ("snapshot_date","cohort","metric_key");--> statement-breakpoint
CREATE INDEX "benchmark_cohort_metrics_date_idx" ON "benchmark_cohort_metrics" USING btree ("snapshot_date","cohort");--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'benchmarks_refreshed';--> statement-breakpoint
ALTER TABLE "tenant_benchmark_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_tenant_benchmark_snapshots" ON "tenant_benchmark_snapshots" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));