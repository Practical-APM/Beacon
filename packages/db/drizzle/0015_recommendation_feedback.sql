CREATE TYPE "public"."feedback_rating" AS ENUM('helpful', 'not_helpful');--> statement-breakpoint
CREATE TYPE "public"."feedback_target_type" AS ENUM('insight', 'recommendation');--> statement-breakpoint
CREATE TABLE "recommendation_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"risk_id" uuid,
	"insight_id" uuid,
	"recommendation_id" uuid,
	"target_type" "feedback_target_type" NOT NULL,
	"rating" "feedback_rating" NOT NULL,
	"comment" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_insight_id_project_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."project_insights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recommendation_feedback_tenant_created_idx" ON "recommendation_feedback" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "recommendation_feedback_project_idx" ON "recommendation_feedback" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_feedback_user_insight_idx" ON "recommendation_feedback" USING btree ("tenant_id","user_id","insight_id") WHERE "insight_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_feedback_user_recommendation_idx" ON "recommendation_feedback" USING btree ("tenant_id","user_id","recommendation_id") WHERE "recommendation_id" IS NOT NULL;--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'recommendation_feedback_submitted';
