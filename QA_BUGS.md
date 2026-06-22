# Beacon — QA Bug Register

**Owner:** QA  
**Last audit:** 2026-06-15  
**Environment:** Local dev (`make dev`), seeded DB, `.env` without Clerk keys (dev-auth mode per `.env.example`)  
**Process:** Add new findings here during QA passes. Link blockers to sprint planning.

---

## Severity

| Level | Meaning |
| ----- | ------- |
| **P0** | App unusable, data loss/corruption risk, or security hole |
| **P1** | Major feature broken or materially wrong behavior |
| **P2** | Edge case, degraded UX, or test/ops gap |

---

## Test Summary (2026-06-15)

| Check | Result |
| ----- | ------ |
| `npm run test` (API, live DB) | **Pass** — 76/76 tests |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (warnings only) |
| `npm run build` (API) | Pass |
| `npm run build` (web, clean `.next`) | Pass |
| API `/health` | 200 OK (when API running) |
| Web `/` (no Clerk key) | **200 OK** |
| `make db-migrate` | Pass through `0023` |

---

## Open Bugs

| ID | Sev | Area | Summary | Status |
| -- | --- | ---- | ------- | ------ |
| BUG-001 | P0 | DB | Migrations `0020`–`0023` registered in Drizzle journal. | **Resolved** |
| BUG-002 | P0 | DB/API | `integration_settings` column missing on DBs migrated before `0020`. | **Resolved** (2026-06-15 — `make db-migrate`) |
| BUG-003 | P0 | Web/Auth | Without Clerk key, all web routes returned HTTP 500 (`clerkMiddleware` init). | **Resolved** (2026-06-15) |
| BUG-004 | P1 | DB/API | HubSpot enum missing until migration `0021` applied. | **Resolved** (2026-06-15) |
| BUG-005 | P1 | Auth/RBAC | Dev tokens used synthetic `@dev.beacon.test` email; contributor RBAC saw zero projects when user row predated seed. | **Resolved** (2026-06-15) — map dev auth IDs to seed emails on upsert + seed repair |
| BUG-006 | P1 | Integrations | Setup/core-crm APIs 500 when BUG-002 present. | **Resolved** (2026-06-15) |
| BUG-007 | P1 | Dashboard | Benchmarks 500 when BUG-002 present. | **Resolved** (2026-06-15) |
| BUG-008 | P1 | Web/Auth | `/notifications/unsubscribe` not in public middleware routes. | **Resolved** (2026-06-15) |
| BUG-009 | P1 | Security | Jira inbound webhooks: header-presence only. | **Resolved** (TD-018) |
| BUG-010 | P1 | Cache | Dashboard cache not invalidated after sync. | **Resolved** (TD-011) |
| BUG-011 | P1 | Integrations | Background sync jobs swallowed errors. | **Resolved** (TD-012) |
| BUG-012 | P1 | HubSpot | Live OAuth sync throws for non-mock tokens. | **Resolved** — `fetchLiveDeals` + `HubSpotClient` implemented |
| BUG-013 | P1 | Revenue | Cross-currency ARR summed without FX. | **Resolved** (TD-010) |
| BUG-014 | P2 | Web/Setup | `SetupFlowGuard` caught all setup-state errors silently. | **Resolved** (2026-06-15) |
| BUG-015 | P2 | Web/Dashboard | Dashboard secondary fetch failures only set dismissible warning. | **Resolved** (TD-025) — `partialWarning` banner |
| BUG-016 | P2 | Web/Onboarding | `OnboardingWizard.refreshSetup()` swallows errors. | **Resolved** (2026-06-15) |
| BUG-017 | P2 | GCal | Google Calendar OAuth metadata hardcodes domains. | **Resolved** (TD-017) — derived from OAuth account email |
| BUG-018 | P2 | Tooling | `make lint` / `npm run lint` fails on `@beacon/web`: no ESLint config. | **Resolved** (2026-06-15) |
| BUG-019 | P2 | Tests | API integration tests skip without DB. | **Resolved** (2026-06-15) — global setup seeds DB; 76/76 pass |
| BUG-020 | P2 | Tests | Web app has limited route/component coverage. | **Resolved** (2026-06-15) — 38 Vitest + Playwright E2E for dashboard, integrations, settings, onboarding |
| BUG-021 | P2 | Build | Web production build can fail with stale `.next` while `make dev` runs. | **Mitigated** — `npm run build:clean --workspace=@beacon/web` |

---

## Detailed Findings

### BUG-001 / BUG-002 — Schema drift (P0)

**Steps to reproduce**
1. `make up && make db-migrate && make db-seed && make dev`
2. Observe API logs: `column "integration_settings" does not exist` every minute
3. `curl -H "Authorization: Bearer dev:admin-a" -H "x-tenant-id: <tenant>" http://localhost:3001/v1/integrations/core-crm/readiness`

**Expected:** 200 with readiness snapshot  
**Actual:** 500 — `column "integration_settings" does not exist`

**Root cause:** `tenants.integration_settings` added in schema + `0020_integration_settings.sql`, but migration not in Drizzle journal. Code uses `db.select().from(tenants)` which selects all ORM columns.

**Fix:** Register and apply migrations `0020` and `0021`; run `make db-migrate` (or `make reset`).

**Files:** `packages/db/drizzle/0020_integration_settings.sql`, `packages/db/drizzle/meta/_journal.json`, `packages/db/src/schema/index.ts`, `apps/api/src/services/integrations/tenant-integration-settings.ts`

---

### BUG-003 — Web 500 without Clerk (P0)

**Steps to reproduce**
1. Use `.env` with Clerk keys commented out (default `.env.example`)
2. `make dev`
3. Open `http://localhost:3000`

**Expected:** Marketing home and dev sign-in load (layout already sets `authDevMode`)  
**Actual:** HTTP 500 — `@clerk/nextjs: Missing publishableKey`

**Root cause:** `export default clerkMiddleware(...)` initializes Clerk before the early-return dev bypass executes.

**Fix:** Conditionally export passthrough middleware when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is unset, or provide a dummy key in dev.

**Files:** `apps/web/src/middleware.ts`, `apps/web/src/app/layout.tsx`

---

### BUG-005 — Contributor dev auth email mismatch (P1)

**Steps to reproduce**
1. Sign in as `contributor-a` via dev form
2. Open dashboard or `GET /v1/projects`

**Expected:** Contributor sees owned projects (`contributor-a@acme-demo.test` in seed)  
**Actual:** `activeProjects: 0`, empty project list — access filter compares `contributor-a@dev.beacon.test` to seed owner emails

**Files:** `apps/api/src/lib/auth.ts`, `apps/api/src/lib/access.ts`, `packages/db/src/seed-demo-data.ts`, `apps/web/src/components/dev-sign-in-form.tsx`

---

### BUG-008 — Unsubscribe route requires auth with Clerk (P1)

**Steps to reproduce**
1. Configure Clerk keys
2. Open email unsubscribe link `/notifications/unsubscribe?token=…` while signed out

**Expected:** Page loads and calls public `GET /v1/notifications/unsubscribe`  
**Actual:** Middleware redirects to `/sign-in` — user cannot unsubscribe from email

**Fix:** Add `/notifications/unsubscribe(.*)` to `isPublicRoute`.

**Files:** `apps/web/src/middleware.ts`, `apps/web/src/app/notifications/unsubscribe/page.tsx`

---

### BUG-009 — Jira webhook verification weak (P1)

**Steps to reproduce**
1. `POST /v1/webhooks/jira` with JSON body and header `x-atlassian-webhook-identifier: anything` (non-dev mode)
2. Include `x-tenant-id` header

**Expected:** Cryptographic verification of Atlassian signature  
**Actual:** Request accepted; event enqueued

**Files:** `apps/api/src/routes/v1/webhooks.ts`

---

### BUG-010 — Dashboard cache stale after sync (P1)

**Steps to reproduce**
1. Load dashboard (cached summary)
2. Trigger Salesforce/Jira sync that changes project/risk data without publishing canonical events
3. Reload dashboard within 60s

**Expected:** Updated metrics  
**Actual:** Cached summary served — sync services do not call `invalidateTenantDashboardCache`

**Files:** `apps/api/src/services/salesforce/sync.ts`, `apps/api/src/services/jira/sync.ts`, `apps/api/src/services/slack/sync.ts`, `apps/api/src/services/hubspot/sync.ts`, `apps/api/src/lib/dashboard-cache.ts`

---

## Affected Endpoints (verified 500 with seeded tenant)

When BUG-002 is present:

| Endpoint | Error |
| -------- | ----- |
| `GET /v1/integrations/core-crm/readiness` | `integration_settings` missing |
| `GET/PATCH /v1/integrations/core-crm/preference` | same |
| `GET /v1/integrations/setup/state` | same |
| `GET /v1/benchmarks/portfolio` | same |
| `GET /v1/admin/risk-rules` | same |
| `GET /v1/integrations/hubspot/status` | `integration_source: "hubspot"` invalid (BUG-004) |

Working despite schema drift (do not query full `tenants` row):

| Endpoint | Notes |
| -------- | ----- |
| `GET /v1/dashboard` | 200 |
| `GET /v1/risks` | 200 |
| `GET /v1/projects` | 200 |
| `GET /v1/integrations/salesforce/status` | 200 |
| `GET /v1/integrations/jira/status` | 200 |
| `GET /v1/integrations/slack/status` | 200 |
| `GET /v1/notifications` | 200 |
| `GET /v1/me` | 200 |

---

## Recommended Fix Order

1. **BUG-001 / BUG-002 / BUG-004** — Apply missing migrations; unblocks setup, settings, benchmarks, HubSpot, notification scheduler noise
2. **BUG-003** — Restore local web dev without Clerk
3. **BUG-005** — Align dev-token email with seed users (or map dev IDs to DB emails)
4. **BUG-008 / BUG-009** — Security hardening before pilot
5. **BUG-010 / BUG-011** — Data freshness and observability

---

## Cross-References

Items tracked as engineering debt (not duplicated here unless user-facing): see [TECH_DEBT.md](./TECH_DEBT.md) TD-007–TD-028.

---

*Update this file after each QA pass. Re-run `make test`, API smoke curls, and a manual walkthrough of sign-in → setup → dashboard → project detail → settings → integrations after fixes.*
