ALTER TABLE "users" ADD COLUMN "dpa_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dpa_version" text;--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'dpa_accepted';
