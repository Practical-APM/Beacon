# Beacon — Readiness Register

**Owner:** Engineering / QA  
**Last audit:** 2026-06-15  
**Related:** [QA_BUGS.md](./QA_BUGS.md) · [TECH_DEBT.md](./TECH_DEBT.md) · [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md)

Tracks web sanity, pilot readiness, and scalability posture. Update status when gates pass or regress.

---

## Severity & gates

| Gate | Meaning |
| ---- | ------- |
| **G0** | Launch blocker — app unusable or data/security risk |
| **G1** | Pre-pilot — major feature broken for design partners |
| **G2** | Post-pilot — edge cases, ops, or scale headroom |

| Horizon | Target (DEVELOPMENT_REFERENCE) | Readiness |
| ------- | ------------------------------ | --------- |
| **Internal demo** | Engineers can run full flow locally | **Pass** (migrations + tests green) |
| **Design partner pilot** | 3 customers (BRD gate) | Not ready |
| **Year 1 scale** | ~100 customers | Architecture OK with worker split |
| **Year 3 scale** | ~10K customers / 100M events/mo | Requires queue + DB refactor |

---

## NFR targets

| Metric | Target | Last verified | Status |
| ------ | ------ | ------------- | ------ |
| API p95 | < 2s | 2026-06-15 — 50 projects / 100K events | **Pass** (dashboard p95 172ms at scale) |
| Dashboard load | < 3s | Static build OK; web `/dashboard` 200 in smoke | Partial |
| Availability | 99.9% | Single-process API | Open |
| Rate limit | 100 req/min/tenant | Implemented (Redis) | Pass |

---

## Web app sanity

| ID | Sev | Area | Finding | Status | Fix / notes |
| -- | --- | ---- | ------- | ------ | ----------- |
| RDY-W01 | G0 | Auth | `clerkMiddleware()` throws without publishable key | **Resolved** (2026-06-15) | Conditional middleware wrapper |
| RDY-W02 | G0 | DB | Pending migrations (`0020`–`0023`) not applied on existing DBs | **Resolved** (2026-06-15) | Run `make db-migrate`; includes Slack multi-channel mapping fix (`0023`) |
| RDY-W03 | G1 | Auth | Dev token email broke contributor RBAC vs seed | **Resolved** (2026-06-15) | DB email in auth context; preserve seed on upsert |
| RDY-W04 | G1 | Auth | `/notifications/unsubscribe` not public in middleware | **Resolved** (2026-06-15) | Added to `isPublicRoute` |
| RDY-W05 | G2 | Tooling | Web ESLint not configured | **Resolved** (2026-06-15) | `apps/web/.eslintrc.json` |
| RDY-W06 | G2 | UX | Setup guard / onboarding swallow API errors | **Resolved** (2026-06-15) | `FeedbackBanner` on setup guard + wizard `refreshSetup` |
| RDY-W07 | G2 | Tests | Web: 3 test files; API integration tests need live DB | **Resolved** (2026-06-15) | 78/78 API + 38 web Vitest; Playwright route E2E (`npm run test:e2e --workspace=@beacon/web`) |
| RDY-W08 | G2 | Build | Stale `.next` + concurrent dev can break production build | **Mitigated** | Use `npm run build:clean --workspace=@beacon/web` or `make clean` before release builds |
| RDY-W09 | G1 | Deploy | Vercel production build | **Pass** (2026-06-18) | `make verify-vercel`; Root Directory `apps/web`; see `apps/web/.env.example` |

### Route coverage (15 pages)

| Route | MVP role | Sanity |
| ----- | -------- | ------ |
| Marketing (`/`, `/docs`, `/faq`, `/pricing`, `/security`) | GTM | Pass (dev auth) |
| Auth (`/sign-in`, `/sign-up`, `/select-org`) | Access | Pass (dev auth) |
| `/dashboard`, `/projects/[id]` | Core product | Pass (web 200; API OK) |
| `/integrations`, `/integrations/setup` | Onboarding | Pass (after migrations) |
| `/settings` | Admin + prefs | Pass (after migrations) |
| `/notifications/unsubscribe` | Compliance | RDY-W04 |
| `/legal/dpa` | Legal | Public API OK |

### Web architecture notes

- **Strengths:** Unified `useApiClient`, dual Clerk/dev auth in layout, RBAC banners, i18n, skip links.
- **Risks:** Client-heavy pages with multi-fetch waterfalls; 3s polling during sync; middleware bundle ~86 kB (Clerk).

---

## Pilot readiness checklist

| # | Criterion | Status |
| - | --------- | ------ |
| 1 | Local dev works with `.env.example` (no Clerk keys) | Pass |
| 2 | Migrations applied through latest (`0023`) | **Pass** (`make db-migrate`) |
| 3 | End-to-end: sign-in → setup → dashboard → project | **Pass** (`make e2e-smoke TENANT_ID=…`) |
| 4 | At least one live OAuth path verified (SF or HubSpot) | Open |
| 5 | Email unsubscribe works signed-out | Pass (RDY-W04) |
| 6 | Contributor role sees scoped projects in dev | Pass (RDY-W03) |
| 7 | `npm run test` + typecheck + lint in CI | **Pass** — 78/78 API + 38 web Vitest with live DB |
| 8 | Load test p95 < 2s on seeded tenant | **Pass** (baseline + `make db-seed-load-test` scale) |
| 9 | Webhook signature verification (Jira/Slack) | Resolved (TD-018) |
| 10 | No open G0 items in QA_BUGS | **Pass** (G0 resolved) |

**Pilot score:** ~65/100 external · ~85/100 internal demo

---

## Scalability register

| ID | Horizon | Component | Finding | Severity | Mitigation |
| -- | ------- | --------- | ------- | -------- | ---------- |
| RDY-S01 | Y1 | Tenancy | Postgres RLS + `withTenantContext` | Strength | Keep |
| RDY-S02 | Y1 | Reads | Redis dashboard cache (60s TTL) | Strength | Replace `redis.keys` with SCAN (TD follow-up) |
| RDY-S03 | Y1 | API | Per-tenant rate limit 100/min | Strength | Keep |
| RDY-S04 | Y1 | Lists | Cursor pagination (limit ≤ 100) | Strength | Keep |
| RDY-S05 | Y1 | Events | BullMQ realtime (5) + bulk (2) workers | Strength | Split from HTTP process |
| RDY-S06 | Y1 | Load test | Seed hook: 50 projects / 10K tasks / 100K events | Strength | Run before pilot |
| RDY-S07 | Y2 | API | Monolith: HTTP + schedulers + sync in one process | Risk | Separate worker containers |
| RDY-S08 | Y2 | Schedulers | Risk eval loops all tenants serially every 6h | Risk | Queue per-tenant jobs |
| RDY-S09 | Y2 | Notifications | Digest scan all prefs every 60s | Risk | Timezone-indexed scheduling |
| RDY-S10 | Y2 | DB pool | `max: 10` connections, singleton client | Risk | Pool per process + PgBouncer |
| RDY-S11 | Y2 | Sync | CRM sync via `runInBackground` in API | Risk | Dedicated sync queue |
| RDY-S12 | Y3 | Cache | `invalidateTenantDashboardCache` uses `KEYS` | Risk | Key registry or SCAN |
| RDY-S13 | Y3 | LLM | Insight generation per project post-risk-eval | Risk | Batch + throttle |
| RDY-S14 | Y3 | Events | 100M events/mo target | Gap | Partitioning, read replicas |

### Scaling path (priority)

1. Apply migrations + fix G0 web/auth issues (this sprint)
2. Extract BullMQ workers + schedulers from API HTTP process
3. Queue CRM sync jobs (same pattern as canonical events)
4. Parallelize tenant risk evaluation via BullMQ
5. Run `make db-seed-load-test` + `make load-test TENANT_ID=…`
6. Read replica for dashboard aggregates; replace `redis.keys`

---

## Change log

| Date | Change |
| ---- | ------ |
| 2026-06-15 | Initial register from QA audit + readiness/scalability analysis |
| 2026-06-15 | G0 fixes: middleware dev bypass, dev auth email/RBAC, unsubscribe route, ESLint; Salesforce `isFirstSync` type fix |
| 2026-06-15 | Migrations applied (`0020`–`0023`); 76/76 API integration tests pass; Slack multi-channel mapping unique index; setup error surfacing |
| 2026-06-15 | Contributor dev-auth email repair; 78/78 API tests; smoke verified contributor sees 10 owned projects |
| 2026-06-15 | Load test NFR pass (p95 < 2s); web setup-orchestrator tests; `build:clean` script for stale `.next` |
| 2026-06-15 | Scale load test (50 projects / 100K events); `make e2e-smoke` API walkthrough (10/10 steps) |
| 2026-06-15 | BUG-020: 14 web Vitest files (dashboard, integrations, settings, onboarding); Playwright route E2E |

---

*Update after each QA pass or sprint retro. Resolve items in code first, then mark **Resolved** here and cross-link in [QA_BUGS.md](./QA_BUGS.md).*
