# Beacon — Technical Debt Register

**Owner:** Engineering  
**Last audit:** 2026-06-15  
**Process:** Each sprint allocates ~15–20% capacity to debt reduction. Update status when resolved.

---

## Severity

| Level | Meaning |
| ----- | ------- |
| **P0** | Launch blocker or security risk |
| **P1** | Pre-pilot quality / reliability gap |
| **P2** | Maintainability / deferred edge cases |

---

## Sprint Allocation

| Sprint | Theme | Debt items |
| ------ | ----- | ------------ |
| **TD-S1** | Auth & API client | TD-001, TD-002, TD-004, TD-006 |
| **TD-S2** | Notifications & ops alerts | TD-003, TD-005 |
| **TD-S3** | Data accuracy & cache | TD-010, TD-011, TD-012 |
| **TD-S4** | Test pyramid | TD-013, TD-014, TD-015, TD-016 |
| **TD-S5** | Integrations hardening | TD-007, TD-008, TD-009, TD-018 |
| **TD-S6** | Cleanup & register | TD-021, TD-022, TD-023, TD-026, TD-027, TD-028 |

---

## Register

| ID | Sev | Category | Description | Status | Sprint |
| -- | --- | -------- | ----------- | ------ | ------ |
| TD-001 | P0 | Auth | Web API client always sent `Bearer dev:` even with Clerk configured | **Resolved** (2026-06-15) | TD-S1 |
| TD-002 | P0 | Auth | Sign-in flow dev-only; no Clerk `<SignIn />` bridge | **Resolved** (2026-06-15) | TD-S1 |
| TD-003 | P0 | Notifications | Email delivery stub (logs only, no SES/Resend) | **Resolved** (2026-06-15) | TD-S2 |
| TD-004 | P0 | Security | Dev token bypass reachable if misconfigured in staging/prod | **Resolved** (2026-06-15) | TD-S1 |
| TD-005 | P0 | Integrations | OAuth refresh failure → degraded but no admin alert (EC-002) | **Resolved** (2026-06-15) | TD-S2 |
| TD-006 | P1 | Architecture | Duplicate inline `fetch` + dev auth in settings/integrations | **Resolved** (2026-06-15) | TD-S1 |
| TD-007 | P1 | Mocks | Mock sync/LLM paths reachable when OAuth not configured | **Resolved** (2026-06-15) | TD-S5 |
| TD-008 | P1 | UX | Mock Connect buttons visible in integrations UI | **Resolved** (2026-06-15) | TD-S5 |
| TD-009 | P1 | Salesforce | Field-mapping health uses static field list, not live describe | **Resolved** (2026-06-15) | TD-S5 |
| TD-010 | P1 | Revenue | Portfolio ARR sums across currencies without FX (EC-017) | **Resolved** (2026-06-15) | TD-S3 |
| TD-011 | P1 | Cache | Dashboard cache not invalidated after integration sync (EC-013) | **Resolved** (2026-06-15) | TD-S3 |
| TD-012 | P1 | Observability | Background sync jobs swallow errors (`catch(() => undefined)`) | **Resolved** (2026-06-15) | TD-S3 |
| TD-013 | P1 | Tests | `packages/db` has zero tests despite RLS backbone | **Resolved** (2026-06-15) | TD-S4 |
| TD-014 | P1 | Tests | Web app nearly untested (2 unit test files) | **Resolved** (2026-06-15) | TD-S4 |
| TD-015 | P1 | Tests | API integration tests skip silently without seeded DB | **Resolved** (2026-06-15) | TD-S4 |
| TD-016 | P1 | Tests | No tests for integration-setup routes | **Resolved** (2026-06-15) | TD-S4 |
| TD-017 | P1 | GCal | Hardcoded internal/customer domains in OAuth metadata (EC-020) | **Resolved** (2026-06-15) | TD-S6 |
| TD-018 | P1 | Security | Jira/Slack webhooks: header-presence only, no crypto verify | **Resolved** (2026-06-15) | TD-S5 |
| TD-021 | P2 | Deprecated | `setup-readiness` legacy `salesforce`/`jira`/`slack` fields | **Resolved** (2026-06-15) | TD-S6 |
| TD-022 | P2 | Duplication | Jira/Slack integration UI sections copy-pasted | **Resolved** (2026-06-15) | TD-S6 |
| TD-023 | P2 | Docs | SSOT mentions Neo4j/Kafka; impl uses PG + BullMQ | **Resolved** (2026-06-15) | TD-S6 |
| TD-025 | P2 | UX | Dashboard silently degrades on secondary fetch failure | **Resolved** (2026-06-15) | TD-S6 |
| TD-026 | P2 | Process | Edge Case Register (EC-001–020) all still "Planned" | **Resolved** (2026-06-15) | TD-S6 |
| TD-027 | P2 | Slack | No proactive bot-access UI before channel mapping (EC-008) | **Resolved** (2026-06-15) | TD-S6 |
| TD-028 | P2 | UX | Initial sync progress UI but no email-on-complete (EC-010) | **Resolved** (2026-06-15) | TD-S6 |

---

## Resolved

| ID | Resolved | Notes |
| -- | -------- | ----- |
| TD-001 | 2026-06-15 | Unified `getAuthHeaders()` + Clerk JWT in `useApiClient` |
| TD-002 | 2026-06-15 | Clerk `<SignIn />` / `<SignUp />` when keys configured |
| TD-003 | 2026-06-15 | Resend email provider; mock in dev/test |
| TD-004 | 2026-06-15 | Dev tokens blocked in staging/production; env transform hardened |
| TD-005 | 2026-06-15 | Admin in-app + email alerts on OAuth/auth integration failures |
| TD-006 | 2026-06-15 | Settings, integrations, onboarding, DPA use `useApiClient` |
| TD-010 | 2026-06-15 | Per-currency ARR breakdown; no silent cross-currency totals |
| TD-011 | 2026-06-15 | Dashboard cache invalidated after integration sync completes |
| TD-012 | 2026-06-15 | Background jobs log failures via `runInBackground` |
| TD-013 | 2026-06-15 | RLS + tenant context tests in `@beacon/db` |
| TD-014 | 2026-06-15 | Web portfolio revenue label + api-auth tests |
| TD-015 | 2026-06-15 | CI fails when DB missing; shared integration test env |
| TD-016 | 2026-06-15 | Integration setup route tests added |
| TD-007 | 2026-06-15 | Mock connect/sync/LLM gated behind AUTH_DEV_MODE |
| TD-008 | 2026-06-15 | Integrations UI hides connect when OAuth unavailable |
| TD-009 | 2026-06-15 | Salesforce mapping health uses live Opportunity describe |
| TD-018 | 2026-06-15 | Jira shared-secret/HMAC + Slack signing verification |
| TD-017 | 2026-06-15 | GCal internal domain derived from OAuth account email |
| TD-021 | 2026-06-15 | Removed legacy setup-readiness snapshot keys |
| TD-022 | 2026-06-15 | Shared IntegrationConnectPanel + SlackBotAccessPanel |
| TD-023 | 2026-06-15 | TRD documents PG + BullMQ as implemented stack |
| TD-025 | 2026-06-15 | Dashboard partialWarning banner for secondary fetch failures |
| TD-026 | 2026-06-15 | Edge Case Register statuses audited in SPRINT_PLAN |
| TD-027 | 2026-06-15 | Slack bot invite panel + mapping guard before save |
| TD-028 | 2026-06-15 | Admin email + in-app alert on first bulk CRM sync |

---

## Edge Case Register cross-reference

All **Planned** and **Partial** edge cases are resolved. Recent closures: EC-001 (API tenant isolation tests), EC-014 (contributor project/customer scoping), EC-018 (GDPR deletion processing), EC-020 (domain collision warnings + GCal overrides).

---

*Update this file at sprint retro. Link from [SPRINT_PLAN.md](./SPRINT_PLAN.md).*
