# Beacon

**Datadog for Customer Implementations** — proactive implementation risk intelligence for B2B SaaS.

## Documentation

| Document | Purpose |
| -------- | ------- |
| [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) | Single source of truth for development |
| [READINESS.md](./READINESS.md) | Pilot readiness, web sanity, scalability register |
| [QA_BUGS.md](./QA_BUGS.md) | QA bug register |
| [TECH_DEBT.md](./TECH_DEBT.md) | Technical debt register |
| [SPRINT_PLAN.md](./SPRINT_PLAN.md) | Sprint-by-sprint roadmap |

## Stack

- **Web:** Next.js 15, React 19, TypeScript, TailwindCSS
- **API:** Hono (Node), REST-first
- **Database:** PostgreSQL 16 + Drizzle ORM
- **Cache / Queue:** Redis 7 (BullMQ in Sprint 5)
- **Monorepo:** npm workspaces + Turborepo

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- Docker Desktop (Postgres + Redis)
- Make (optional, recommended)

## Quick Start

```bash
# 1. Clone and install
cp .env.example .env
make install

# 2. Start infrastructure
make up

# 3. Run migrations and seed demo data
make db-migrate
make db-seed

# 4. Start dev servers (web :3000, api :3001)
make dev
```

Open [http://localhost:3000](http://localhost:3000) — the status panel checks API `/health` and `/ready`.

## Project Structure

```
apps/
  web/          Next.js frontend
  api/          Hono REST API
packages/
  shared/       Types, constants, Zod env schemas
  db/           Drizzle schema, migrations, seed
```

## API Endpoints (Sprint 0)

| Endpoint | Description |
| -------- | ----------- |
| `GET /health` | Liveness check |
| `GET /ready` | Readiness (Postgres + Redis) |

All responses include `x-request-id`. Pass `x-tenant-id` for tenant-scoped requests (Sprint 1+).

## Local Commands

```bash
make reset       # Wipe DB volumes, migrate, seed
make test        # Run all tests
make typecheck   # TypeScript check
make build       # Production build
```

## Staging Deployment

Step-by-step free-tier guide: **[docs/deploy-free.md](./docs/deploy-free.md)**

| Service | Platform | Config |
| ------- | -------- | ------ |
| Web | Vercel | `apps/web/vercel.json` |
| API | Railway (or Fly.io) | `railway.toml` |
| Postgres | Neon | — |
| Redis | Upstash | — |

Configure environment variables from `.env.example` in each platform's dashboard.

## Architecture Decision (Sprint 0)

**Separate Hono API** instead of Next.js API routes — supports independent scaling, clearer API-first boundary, and aligns with TRD multi-service architecture.

## Product experience

Beacon is designed as a **customer-facing open source SaaS**, not an internal monitoring console.

| Surface | URL | Notes |
| ------- | --- | ----- |
| Website & app | http://localhost:3000 | Marketing home, docs, FAQ, security, pricing |
| App workspace | http://localhost:3000/sign-in → `/dashboard` | Portfolio, projects, settings |
| API | http://localhost:3001 | REST API |

**User preferences:** Settings → Language, **Currency display** (number/symbol formatting), and **Appearance** (light/dark/system).

**Trust:** SOC 2 Type II, GDPR, and ISO 27001 aligned. DPA in app; full details on the marketing security page.

## Current Sprint

**Sprint 21 — Predicted Delay Confidence Intervals** ✅ complete  
**Previous: Sprint 20 — Portfolio Benchmarking** ✅ complete

### Predicted Delay Confidence Intervals (Sprint 21)

Heuristic go-live delay estimates with 80% confidence intervals on project detail pages.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/projects/:projectId/delay-prediction` | Authenticated | Predicted delay, CI, on-time probability |

- Shared `@beacon/shared/delay-prediction` — risk-weighted delay model + peer dispersion
- Uses open risk score/count, integration completeness, and benchmark cohort spread
- Tenant feature flag `delayPredictionsEnabled` (default on)
- Global kill switch `FEATURE_DELAY_PREDICTIONS_ENABLED`
- Project detail **Predicted delay** panel with go-live range and model basis

### Portfolio Benchmarking (Sprint 20)

Anonymized peer comparisons for opted-in tenants (Stage 2 preview from `expansion.md`).

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/benchmarks/portfolio` | Authenticated | Tenant metrics vs peer p25/p50/p75 |
| `GET /v1/admin/benchmarks/status` | Admin | Participation + latest snapshot status |
| `POST /v1/admin/benchmarks/refresh` | Admin | Capture today's tenant snapshot |
| `POST /v1/admin/benchmarks/refresh-cohort` | Admin | Refresh all participating tenants |

Run `make db-migrate` to apply migration `0018_benchmarking`.

- Migration `0018_benchmarking` — `tenant_benchmark_snapshots`, `benchmark_cohort_metrics`
- Tenant feature flag `benchmarkParticipationEnabled` (opt-in, default off)
- Global kill switch `FEATURE_BENCHMARKS_ENABLED`
- k-anonymity: cohort percentiles hidden until ≥3 participating tenants
- Dashboard peer benchmark panel; admin refresh in Settings
- Metrics: at-risk rate, average risk score, days to go-live, open risks per project

### Internationalization (Sprint 19)

User-facing UI strings in English, Spanish, German, and French.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `PATCH /v1/me/locale` | Authenticated | Set user locale (`en`, `es`, `de`, `fr`) |
| `GET /v1/me` | Authenticated | Includes `user.locale` |

Run `make db-migrate` to apply migration `0017_user_locale`.

- Shared message catalog in `@beacon/shared/i18n` with `translate()` helper
- Web `I18nProvider` + `useTranslation()` hook; updates `document.lang`
- Settings → **Language** selector persists preference per user
- Translated: app shell nav, dashboard header, empty risk state, settings headers, load-more button
- LLM insights already respect tenant `locale` from intelligence settings (Sprint 9)

### Custom Risk Rules (Sprint 18)

Tenant admins can tune rule-based risk detection without code changes.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/admin/risk-rules` | Admin | Merged rule configs with labels and descriptions |
| `PATCH /v1/admin/risk-rules` | Admin | Update enablement, severity, scores, thresholds |
| `POST /v1/admin/risk-rules/reset` | Admin | Reset tenant overrides to platform defaults |

Uses existing `tenants.risk_settings` JSON (no schema migration beyond audit enum).

- Per-rule: enabled, severity level, base score, business-day threshold (where supported)
- Global: timezone, hysteresis buffer, acknowledged-risk suppression days
- Saves trigger background risk re-evaluation and audit log entry
- Settings UI section for admins under **Custom risk rules**

### Recommendation Feedback (Sprint 17)

Capture helpful / not helpful ratings on AI explanations for future ML training.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `POST /v1/feedback` | Operational+ | Submit insight or recommendation feedback |
| `GET /v1/projects/:id/feedback` | Operational+ | Current user's feedback for project |
| `GET /v1/admin/feedback/summary` | Admin | Helpful rate and breakdown by source |
| `GET /v1/admin/feedback/export` | Admin | Training export with rule keys and evidence hashes |

Run `make db-migrate` to apply migration `0015_recommendation_feedback`.

- One rating per user per insight/recommendation (upsert on change)
- Helpful → recommendation `accepted`; not helpful → `dismissed`
- Project detail UI: Helpful / Not helpful + optional comment on AI panel
- Admin compliance section shows feedback summary stats

### Outbound Webhooks (Sprint 16)

Signed HTTP callbacks for customer automation when risks change.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/admin/webhooks` | Admin | List webhook subscriptions |
| `POST /v1/admin/webhooks` | Admin | Create subscription (returns signing secret once) |
| `PATCH /v1/admin/webhooks/:id` | Admin | Update URL, enabled state, event filters |
| `DELETE /v1/admin/webhooks/:id` | Admin | Delete subscription |
| `POST /v1/admin/webhooks/:id/test` | Admin | Send signed `ping` event |
| `POST /v1/admin/webhooks/:id/rotate-secret` | Admin | Rotate signing secret |
| `GET /v1/admin/webhooks/deliveries` | Admin | Recent delivery log |

Run `make db-migrate` to apply migration `0014_outbound_webhooks`.

- Event types: `risk.created`, `risk.updated`, `risk.escalated`, `risk.resolved`, plus `ping` for tests
- HMAC-SHA256 signatures via `X-Beacon-Signature`, `X-Beacon-Timestamp`, `X-Beacon-Event`
- Dispatched from risk evaluation and manual risk resolution
- Auto-disables subscriptions after 10 consecutive delivery failures
- Tenant feature flag: `outboundWebhooksEnabled` (+ global `FEATURE_OUTBOUND_WEBHOOKS_ENABLED`)
- Settings UI for subscription management and delivery history

### Google Calendar (Sprint 15)

Engagement signals from meeting frequency and customer-attended meetings.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/integrations/google-calendar/connect-url` | Admin | OAuth connect URL (or mock mode) |
| `POST /v1/integrations/google-calendar/mock-connect` | Admin | Dev mock connect |
| `GET /v1/integrations/google-calendar/status` | Operational | Connection + signal summary |
| `GET /v1/integrations/google-calendar/calendars` | Operational | List calendars + mapping suggestions |
| `POST /v1/integrations/google-calendar/calendar-mappings` | Admin | Map calendar → project |
| `POST /v1/integrations/google-calendar/sync` | Admin | Sync meetings → signals + events |
| `DELETE /v1/integrations/google-calendar/disconnect` | Admin | Disconnect integration |

Run `make db-migrate` to apply migration `0013_google_calendar`.

- `calendar_project_signals` table stores last meeting / customer meeting / 30-day count
- Publishes `calendar_meeting` canonical events during sync
- Risk engine uses calendar signals for inactivity and customer engagement gap detection
- Integrations UI section with mock connect, mapping, and sync

### Hardening & Compliance (Sprint 14)

Production readiness: audit trail, GDPR flows, feature flags, DPA, runbooks, and load testing.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/admin/audit-events` | Admin | Integration/risk/privacy audit trail |
| `POST /v1/privacy/export` | Authenticated | GDPR JSON export for current user |
| `POST /v1/privacy/deletion-request` | Authenticated | Request account data deletion |
| `GET /v1/admin/privacy/deletion-requests` | Admin | List pending deletion requests |
| `GET/PATCH /v1/admin/feature-flags` | Admin | Tenant LLM / Slack alert toggles |
| `GET /v1/legal/dpa` | Public | Data Processing Agreement text |
| `POST /v1/legal/dpa/accept` | Authenticated | Record DPA acceptance |

Run `make db-migrate` to apply migrations `0011_hardening` and `0012_dpa`.

- Settings UI: privacy export/deletion, admin audit log, feature flags, deletion queue
- DPA page at `/legal/dpa` with acceptance flow
- Load seed: `make db-seed-load-test` (50 projects, 10K tasks, 100K events)
- Load smoke test: `make load-test TENANT_ID=<uuid>`
- E2E smoke test: `make e2e-smoke TENANT_ID=<uuid>` (API walkthrough: setup → dashboard → project)
- Security audit: `make security-audit`
- Docs: runbooks, security checklist, pilot checklist, MVP assessment, tenant offboarding

### Notifications (Sprint 13)

Proactive alerts with preference controls, debounced immediate alerts, and daily digests.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/notifications` | Authenticated | In-app notification feed |
| `GET /v1/notifications/unread-count` | Authenticated | Unread badge count |
| `PATCH /v1/notifications/:id/read` | Authenticated | Mark one notification read |
| `POST /v1/notifications/read-all` | Authenticated | Mark all read |
| `GET/PATCH /v1/notifications/preferences` | Authenticated | User channel/frequency/severity prefs |
| `GET /v1/notifications/unsubscribe?token=` | Public | One-click unsubscribe |
| `GET/PATCH /v1/admin/notifications/settings` | Admin | Org-wide notification overrides |
| `POST /v1/admin/notifications/run-digest` | Admin | Trigger digest job (staging/cron test) |

Run `make db-migrate` to apply migration `0010_notifications`.

- Daily digest at local 8am (configurable); skips unchanged risks
- Immediate alerts debounced 24h per risk/severity unless severity increases
- Bell icon in app header; preferences in Settings
- Dev mode logs mock emails to API console

### Project Detail & Integrations UI (Sprint 12)

Drill-down from portfolio to actionable project intelligence with unified timeline and setup flows.

| UI | Description |
| -- | ----------- |
| `/projects/:id` | Overview, health, grouped open risks, evidence links, AI explanation, timeline |
| `/integrations/setup` | Onboarding wizard: connect → map → sync → dashboard |
| `/integrations` | Salesforce field mapping UI, disconnect confirmations, Jira/Slack project mapping |

Project timeline defaults to last 30 days (`?since=30d`). Risk cards on the dashboard link to project detail. Acknowledge/snooze uses optimistic UI with rollback on failure.

### Executive Dashboard (Sprint 11)

Implementation Risk Center with portfolio metrics, paginated risk feed, filters, and marketing-aligned copy.

| UI | Description |
| -- | ----------- |
| `/dashboard` | Active, At Risk, Revenue Delayed, Avg Time-to-Go-Live, Confidence, Trend |
| Risk feed | Cards with customer, level, delay, revenue, root cause, suggested action |
| Filters | Risk level, owner, date range |
| States | Loading skeleton, empty state, stale data banner, sync progress, error retry |
| Print | Basic print stylesheet for board reviews |

Risk feed uses `GET /v1/risks` (enriched with customer name + suggested action) and `GET /v1/dashboard`.

### REST API & Caching (Sprint 10)

Full MVP API surface with Redis-backed dashboard aggregates (60s TTL), tenant rate limiting (100 req/min), optimistic locking on risk updates, and OpenAPI v0.3.0.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/dashboard` | Authenticated | Portfolio summary (active, at-risk, delayed ARR, confidence) |
| `GET /v1/projects` | Authenticated | List with `healthSummary`; filters: `status`, `risk_level`, `owner`; `?format=csv` |
| `GET /v1/projects/:id?detail=full` | Authenticated | Project + customer + open risks + health |
| `GET /v1/revenue-impact` | Authenticated | Deduped per-project ARR impact; `?format=csv` |
| `PATCH /v1/risks/:id` | Operational+ | Status update with optional `version` (409 on conflict) |

Run `make db-migrate` to apply migration `0009_api_caching` (`risks.version`).

- Dashboard cache invalidates on canonical event insert and risk evaluation
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` on 429
- OpenAPI: `GET /v1/openapi.json`
- Postman: [docs/postman/beacon-api.postman_collection.json](./docs/postman/beacon-api.postman_collection.json)

### Intelligence Layer (Sprint 9)

Generates root cause narratives and recommendations from structured risk evidence only. LLM output is validated against evidence IDs; template fallback applies when LLM is disabled, over token cap, or fails.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/projects/:id/insights` | Operational+ | List generated insights for a project |
| `POST /v1/projects/:id/insights/generate` | Operational+ | Generate insights for open risks |
| `GET /v1/risks/:id/insight` | Operational+ | Insight for a specific risk |
| `GET /v1/admin/intelligence` | Admin | LLM settings + daily token usage |
| `PATCH /v1/admin/intelligence` | Admin | Toggle LLM (`llmEnabled`), locale, caps, provider |

Run `make db-migrate` to apply migration `0008_intelligence_layer`.

Insights cache in Redis (1 hour TTL, keyed by evidence hash). Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for live LLM; otherwise mock/template mode is used.

### Slack Integration (Sprint 8)

Connect Slack to ingest channel activity metadata (not full message history), map channels to projects, and feed customer inactivity signals into the risk engine.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/integrations/slack/connect-url` | Admin | OAuth URL + documented scopes |
| `GET /v1/integrations/slack/callback` | Public | OAuth callback |
| `POST /v1/integrations/slack/mock-connect` | Admin | Dev mock connect + 3 channel mappings |
| `GET /v1/integrations/slack/channels` | Operational+ | Channels + auto-suggest mappings |
| `POST /v1/integrations/slack/channel-mappings` | Admin | Link Slack channel ↔ Beacon project |
| `DELETE /v1/integrations/slack/channel-mappings/:id` | Admin | Unmap channel |
| `POST /v1/integrations/slack/sync` | Admin | Bulk/incremental channel signal sync |
| `GET /v1/integrations/slack/status` | Operational+ | Health, signals, bot access errors |
| `DELETE /v1/integrations/slack/disconnect` | Admin | Disconnect integration |
| `POST /v1/webhooks/slack` | Webhook | Real-time message events (metadata only) |

Run `make db-migrate` to apply migration `0007_slack_signals`.

Customer response delay risks prefer Slack signals when connected (`POST /v1/risks/evaluate/sync` after sync).

### Risk Engine (Sprint 7)

Rule-based risk detection with evidence, confidence scores, lifecycle management, and scheduled re-evaluation every 6 hours (plus on graph rebuild and ingested events).

MVP rules: project inactivity (10+ business days), critical dependency overdue, unassigned owners, customer response delay, milestone behind schedule, past-due go-live.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/risks` | Operational+ | Risk feed (`level`, `status` filters) |
| `GET /v1/risks/:id` | Operational+ | Risk detail with evidence |
| `PATCH /v1/risks/:id` | Operational+ | Acknowledge, resolve, snooze (+ optional feedback) |
| `POST /v1/risks/evaluate` | Admin | Trigger async tenant/project evaluation |
| `POST /v1/risks/evaluate/sync` | Admin | Run evaluation synchronously (dev/tests) |
| `GET /v1/risks/evaluate/status` | Operational+ | Latest evaluation job status |

Run `make db-migrate` to apply migration `0006_risk_engine`.

Set `RISK_SCHEDULER_ENABLED=true` (default in development) for the 6-hour evaluation loop.

### Operational Graph (Sprint 6)

Rebuild the tenant graph after syncing data or updating Jira project mappings. Active portfolio views exclude `on_hold`, `completed`, and `cancelled` projects by default.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/graph/portfolio` | Operational+ | Active portfolio summary + unlinked projects |
| `GET /v1/graph/projects/:id` | Operational+ | Project graph nodes and edges |
| `GET /v1/graph/projects/:id/blockers` | Operational+ | Blocked-by chains + cycle warnings |
| `GET /v1/graph/owners/workload` | Operational+ | Open/blocked tasks per resolved owner |
| `GET /v1/graph/entity-links` | Operational+ | Resolved entity links with confidence |
| `POST /v1/graph/entity-links` | Admin | Manual entity merge/link |
| `POST /v1/graph/rebuild` | Admin | Full/incremental graph rebuild |
| `GET /v1/graph/rebuild/status` | Operational+ | Latest rebuild job status |
| `GET /v1/projects?portfolio=active` | Operational+ | Active portfolio project list |

Run `make db-migrate` to apply migration `0005_operational_graph`.

### Event Ingestion (Sprint 5)

Events are processed through BullMQ queues on Redis: `realtime` (webhooks) and `bulk` (sync jobs), with a DLQ for poison messages after 3 retries.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `POST /v1/webhooks/jira` | Webhook | Enqueues `task_updated` / `task_completed` events |
| `POST /v1/admin/events/ingest` | Admin | Queue or sync-ingest a canonical event |
| `GET /v1/admin/ingestion/metrics` | Admin | Throughput, dedup, queue depth |
| `GET /v1/admin/ingestion/dlq` | Admin | List dead-letter jobs |
| `POST /v1/admin/ingestion/dlq/:jobId/replay` | Admin | Replay DLQ job to realtime queue |

Canonical event types: `task_updated`, `task_completed`, `milestone_updated`, `customer_updated`, `slack_message`, `integration_health`.

Deduplication key: `(tenant_id, source, external_event_id)` — duplicate delivery creates one row.

Set `EVENT_WORKERS_ENABLED=true` (default in development) so the API process runs queue workers.

### Jira Integration (Sprint 4)

Use mock mode locally. Sign in as `admin-a`, open [/integrations](http://localhost:3000/integrations), connect mock Jira, then run bulk sync.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/integrations/jira/connect-url` | Admin | OAuth URL |
| `GET /v1/integrations/jira/callback` | Public | OAuth callback |
| `POST /v1/integrations/jira/mock-connect` | Admin | Dev mock connect + default mapping |
| `GET /v1/integrations/jira/projects` | Operational+ | Jira projects + mapping suggestions |
| `POST /v1/integrations/jira/project-mappings` | Admin | Link Jira project ↔ Beacon project |
| `POST /v1/integrations/jira/sync` | Admin | Bulk/incremental sync |
| `GET /v1/integrations/jira/status` | Operational+ | Health, orphans, mappings |
| `GET /v1/projects/:id/task-dependencies` | Operational+ | Blocked-by dependency graph |
| `POST /v1/webhooks/jira` | Webhook | Issue update webhook (polling fallback in dev) |
| `DELETE /v1/integrations/jira/disconnect` | Admin | Disconnect integration |

Run `make db-migrate` to apply migration `0004_jira_dependencies`.

### Salesforce Integration (Sprint 3)

Use mock mode locally (no Salesforce keys required). Sign in as `admin-a`, open [/integrations](http://localhost:3000/integrations), connect mock Salesforce, and run bulk sync.

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/integrations/salesforce/connect-url` | Admin | OAuth URL (production/sandbox) |
| `GET /v1/integrations/salesforce/callback` | Public | OAuth callback |
| `POST /v1/integrations/salesforce/mock-connect` | Admin | Dev mock connect |
| `POST /v1/integrations/salesforce/sync` | Admin | Bulk/incremental sync |
| `GET /v1/integrations/salesforce/status` | Operational+ | Health + progress |
| `PATCH /v1/integrations/salesforce/mappings` | Admin | Field mapping overrides |
| `DELETE /v1/integrations/salesforce/disconnect` | Admin | Disconnect integration |

Run `make db-migrate` to apply migration `0003_salesforce_sync_jobs`.

### Operational API (Sprint 2)

All routes require `Authorization: Bearer dev:admin-a` and `x-tenant-id` (from seed).

| Endpoint | Description |
| -------- | ----------- |
| `GET /v1/customers` | Paginated customers |
| `POST /v1/customers` | Create customer |
| `GET /v1/projects` | Paginated projects |
| `GET /v1/risks` | Risk feed |
| `PATCH /v1/risks/:id` | Update risk status |
| `GET /v1/revenue-impact` | Portfolio ARR at risk |
| `GET /v1/openapi.json` | OpenAPI 3.1 spec |

Query params: `limit` (max 100), `cursor`, `sort=created_at:desc`. Writes support `Idempotency-Key` header.

### Sprint 1 Demo Users (after `make db-seed`)

| Dev login ID | Organization | Role |
| ------------ | ------------ | ---- |
| `admin-a` | Acme Demo Org | admin |
| `contributor-a` | Acme Demo Org | contributor |
| `admin-b` | Globex Demo Org | admin |

Sign in at [/sign-in](http://localhost:3000/sign-in) using development auth (no Clerk keys required).

### Auth API (Sprint 1)

| Endpoint | Auth | Description |
| -------- | ---- | ----------- |
| `GET /v1/me` | Bearer | Current user + memberships |
| `GET /v1/tenants` | Bearer | List organizations |
| `POST /v1/tenants` | Bearer | Create organization |
| `GET /v1/tenants/:id` | Bearer + `x-tenant-id` | Organization detail |
| `PATCH /v1/tenants/:id` | Admin | Update org name |
| `GET /v1/tenants/:id/members` | Operational+ | List members |
| `POST /v1/tenants/:id/invitations` | Admin | Invite user |
| `POST /v1/webhooks/clerk` | Svix signature | Clerk sync webhook |
| `POST /v1/admin/sync` | Admin | Manual identity sync |

Dev auth header: `Authorization: Bearer dev:admin-a`
