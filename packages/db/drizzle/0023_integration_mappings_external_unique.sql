DROP INDEX IF EXISTS "integration_mappings_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "integration_mappings_unique_idx" ON "integration_mappings" USING btree ("tenant_id","integration_id","mapping_type","external_id");--> statement-breakpoint
