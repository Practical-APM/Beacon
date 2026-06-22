# PostgreSQL Backup & Restore Drill

## Objective
Validate RPO ≤ 1 hour and RTO ≤ 4 hours using point-in-time recovery (PITR).

## Prerequisites
- Managed PostgreSQL with WAL archiving enabled (RDS, Cloud SQL, or self-hosted with `archive_mode=on`)
- Recent base backup snapshot
- Staging environment isolated from production

## Drill steps

1. **Record baseline**
   - Note current migration version: latest tag in `packages/db/drizzle/meta/_journal.json`
   - Capture sample tenant row count and checksum query on `projects` table

2. **Simulate failure**
   - Restore base backup to a new staging instance at `T0`
   - Apply WAL logs to recovery target `T0 + 30 minutes`

3. **Validate data**
   - Run `make db-migrate` against restored instance
   - Execute smoke queries: tenant list, dashboard summary for demo tenant
   - Compare row counts to baseline (within RPO window)

4. **Application cutover rehearsal**
   - Point staging API `DATABASE_URL` to restored instance
   - Run `node scripts/load-test.mjs <staging-api> admin-a <tenant-id>`
   - Confirm `/health` and `/v1/dashboard` respond under 2s p95

5. **Document results**
   - Actual RPO achieved
   - Actual RTO (time from failure declaration to API green)
   - Issues found and remediation tickets

## Frequency
Run quarterly and after major schema migrations.
