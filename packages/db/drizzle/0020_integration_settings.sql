ALTER TABLE "tenants" ADD COLUMN "integration_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;
