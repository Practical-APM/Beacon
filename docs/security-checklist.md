# Security Checklist (MVP Launch)

## OWASP Top 10
- [ ] Auth enforced on all `/v1/*` routes except documented public endpoints
- [ ] RBAC enforced for admin/operational routes
- [ ] Tenant isolation verified (`tenant-isolation` tests + manual spot check)
- [ ] Input validation via Zod on mutating endpoints
- [ ] Rate limiting enabled per tenant
- [ ] Secrets not logged (log scrubber redacts token/secret/password keys)
- [ ] Integration credentials encrypted at rest
- [ ] CORS restricted to `CORS_ORIGIN`
- [ ] Dependency audit: `npm audit --production`
- [ ] Security headers on web app (Next.js defaults + review)

## Secret rotation
- [ ] Document owners for Clerk, Salesforce, Jira, Slack, OpenAI keys
- [ ] Rotation procedure tested in staging
- [ ] Old keys revoked after rotation

## Privacy / GDPR
- [ ] `POST /v1/privacy/export` returns user JSON export
- [ ] `POST /v1/privacy/deletion-request` creates tracked request
- [ ] Audit log records GDPR actions

## Launch blockers
- Critical npm audit findings unresolved
- Cross-tenant data access in pen test
- PII in application logs
