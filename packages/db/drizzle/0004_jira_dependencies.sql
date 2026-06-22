ALTER TABLE "tasks" ADD COLUMN "priority" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "labels" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint

CREATE TABLE "task_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	"link_type" text DEFAULT 'blocks' NOT NULL,
	"external_link_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_dependencies_tenant_id_idx" ON "task_dependencies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_task_id_idx" ON "task_dependencies" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_depends_on_task_id_idx" ON "task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_dependencies_unique_idx" ON "task_dependencies" USING btree ("tenant_id","task_id","depends_on_task_id");--> statement-breakpoint
ALTER TABLE "task_dependencies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_task_dependencies" ON "task_dependencies" USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));
