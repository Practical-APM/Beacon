CREATE TABLE "slack_channel_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"mapping_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text,
	"bot_present" boolean DEFAULT false NOT NULL,
	"bot_access_error" text,
	"last_customer_message_at" timestamp with time zone,
	"last_internal_response_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"last_escalation_at" timestamp with time zone,
	"message_sample_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"stale" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slack_channel_signals" ADD CONSTRAINT "slack_channel_signals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_channel_signals" ADD CONSTRAINT "slack_channel_signals_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_channel_signals" ADD CONSTRAINT "slack_channel_signals_mapping_id_integration_mappings_id_fk" FOREIGN KEY ("mapping_id") REFERENCES "public"."integration_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_channel_signals" ADD CONSTRAINT "slack_channel_signals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slack_channel_signals_tenant_id_idx" ON "slack_channel_signals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "slack_channel_signals_project_id_idx" ON "slack_channel_signals" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_channel_signals_channel_idx" ON "slack_channel_signals" USING btree ("tenant_id","channel_id");--> statement-breakpoint
ALTER TABLE "slack_channel_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_slack_channel_signals" ON "slack_channel_signals" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));
