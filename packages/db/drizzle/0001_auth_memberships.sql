-- Sprint 1: Auth, multi-tenant memberships, invitations, RLS

CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint

ALTER TABLE "tenants" ADD COLUMN "external_org_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_external_org_id_idx" ON "tenants" USING btree ("external_org_id");--> statement-breakpoint

CREATE TABLE "tenant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" DEFAULT 'contributor' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'contributor' NOT NULL,
	"invited_by_user_id" uuid,
	"token" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Migrate existing users into global users + memberships
ALTER TABLE "users" ADD COLUMN "new_external_auth_id" text;--> statement-breakpoint
UPDATE "users" SET "new_external_auth_id" = COALESCE("external_auth_id", 'legacy-' || "id"::text);--> statement-breakpoint

CREATE TEMP TABLE "_user_migration" AS
SELECT
  u."id" AS old_id,
  gen_random_uuid() AS new_user_id,
  u."new_external_auth_id" AS external_auth_id,
  u."email",
  u."name",
  u."timezone",
  u."deleted_at",
  u."created_at",
  u."updated_at",
  u."tenant_id",
  u."role"
FROM "users" u;--> statement-breakpoint

DROP TABLE "users" CASCADE;--> statement-breakpoint

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_auth_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"timezone" text DEFAULT 'UTC',
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

INSERT INTO "users" ("id", "external_auth_id", "email", "name", "timezone", "deleted_at", "created_at", "updated_at")
SELECT DISTINCT ON ("external_auth_id")
  "new_user_id", "external_auth_id", "email", "name", "timezone", "deleted_at", "created_at", "updated_at"
FROM "_user_migration"
ORDER BY "external_auth_id", "created_at";--> statement-breakpoint

INSERT INTO "tenant_memberships" ("tenant_id", "user_id", "role", "deleted_at", "created_at", "updated_at")
SELECT m."tenant_id", u."id", m."role", m."deleted_at", m."created_at", m."updated_at"
FROM "_user_migration" m
JOIN "users" u ON u."external_auth_id" = m."external_auth_id";--> statement-breakpoint

DROP TABLE "_user_migration";--> statement-breakpoint

ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "tenant_memberships_tenant_id_idx" ON "tenant_memberships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_memberships_user_id_idx" ON "tenant_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_memberships_tenant_user_idx" ON "tenant_memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_auth_id_idx" ON "users" USING btree ("external_auth_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_tenant_id_idx" ON "invitations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint

-- Row-level security (tenant isolation at DB layer)
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "tenant_isolation_customers" ON "customers"
  USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_integrations" ON "integrations"
  USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_projects" ON "projects"
  USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_memberships" ON "tenant_memberships"
  USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_invitations" ON "invitations"
  USING ("tenant_id"::text = current_setting('app.current_tenant_id', true));
