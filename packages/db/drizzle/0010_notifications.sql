CREATE TYPE "public"."notification_channel" AS ENUM('email', 'slack', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('daily_digest', 'immediate_alert', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('sent', 'failed', 'skipped', 'bounced');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_valid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "global_snooze_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "unsubscribe_token" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "notification_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_unsubscribe_token_idx" ON "users" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"slack_enabled" boolean DEFAULT false NOT NULL,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"min_severity" "risk_level" DEFAULT 'high' NOT NULL,
	"min_confidence" integer DEFAULT 60 NOT NULL,
	"digest_hour_local" integer DEFAULT 8 NOT NULL,
	"last_digest_sent_at" timestamp with time zone,
	"unsubscribed_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "notification_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"risk_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'sent' NOT NULL,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_log" ADD CONSTRAINT "notification_delivery_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_log" ADD CONSTRAINT "notification_delivery_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_log" ADD CONSTRAINT "notification_delivery_log_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_tenant_user_idx" ON "notification_preferences" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_preferences_tenant_id_idx" ON "notification_preferences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notifications_tenant_user_idx" ON "notifications" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_dedupe_idx" ON "notification_delivery_log" USING btree ("tenant_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_delivery_risk_idx" ON "notification_delivery_log" USING btree ("risk_id","sent_at");
