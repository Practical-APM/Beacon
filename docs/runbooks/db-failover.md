# Database Failover Runbook

## Targets
- RTO: 4 hours
- RPO: 1 hour (PITR)

## Failure detection
- `/health` database check returns error
- API 5xx spike on all authenticated routes

## Failover steps
1. Confirm primary PostgreSQL unavailable (provider status + connection errors)
2. Promote read replica or restore latest PITR snapshot to new primary
3. Update `DATABASE_URL` for API and migration jobs
4. Run `make db-migrate` against new primary
5. Invalidate Redis dashboard cache keys (`dashboard:*`)
6. Smoke test: health, dashboard, project detail, integration status

## Post-incident
- Document timeline in incident log
- Verify tenant data isolation still enforced (RLS / tenant context)
- Schedule backup restore drill within 30 days
