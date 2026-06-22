# Pilot Onboarding Checklist

## Pre-flight (internal)
- [ ] Tenant created and admin user invited
- [ ] `make db-migrate` applied through latest migration
- [ ] Feature flags reviewed (`GET /v1/admin/feature-flags`)
- [ ] Notification org settings confirmed (`GET /v1/admin/notifications/settings`)

## Customer setup (day 0)
- [ ] Admin completes Salesforce mock/OAuth connect
- [ ] Field mappings validated against customer schema
- [ ] Jira project mappings configured
- [ ] Slack internal channel mappings configured (no customer channels)
- [ ] Initial bulk sync completed without errors
- [ ] Dashboard shows projects and at least one risk or explicit empty state

## Validation (day 1–3)
- [ ] Executive user can view dashboard and project detail
- [ ] Risk acknowledge/snooze flows work with audit entries
- [ ] Daily digest test via `POST /v1/admin/notifications/run-digest`
- [ ] Load smoke test: `node scripts/load-test.mjs http://localhost:3001 admin-a <tenant-id>`

## Support playbook
- Integration issues → `docs/runbooks/integration-failure.md`
- Slow dashboard → `docs/runbooks/queue-backlog.md`
- Database outage → `docs/runbooks/db-failover.md`
- GDPR request → export via API; deletion requests reviewed by admin within 30 days
