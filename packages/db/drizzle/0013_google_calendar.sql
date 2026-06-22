ALTER TYPE "public"."mapping_type" ADD VALUE 'project_to_calendar';--> statement-breakpoint
CREATE TABLE "calendar_project_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"mapping_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"calendar_id" text NOT NULL,
	"calendar_name" text,
	"last_meeting_at" timestamp with time zone,
	"last_customer_meeting_at" timestamp with time zone,
	"meeting_count_30d" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stale" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "calendar_project_signals" ADD CONSTRAINT "calendar_project_signals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_project_signals" ADD CONSTRAINT "calendar_project_signals_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_project_signals" ADD CONSTRAINT "calendar_project_signals_mapping_id_integration_mappings_id_fk" FOREIGN KEY ("mapping_id") REFERENCES "public"."integration_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_project_signals" ADD CONSTRAINT "calendar_project_signals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_project_signals_tenant_id_idx" ON "calendar_project_signals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "calendar_project_signals_project_id_idx" ON "calendar_project_signals" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_project_signals_calendar_idx" ON "calendar_project_signals" USING btree ("tenant_id","calendar_id");
