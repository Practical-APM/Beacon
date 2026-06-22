# Beacon — Sprint Plan

**Version:** 1.0  
**Status:** Active development roadmap  
**Reference:** [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) (SSOT)  
**Sprint length:** 2 weeks  
**Team assumption:** 2–4 engineers + 1 product (adjust scope per sprint if smaller)

---

## How to Use This Plan

1. Each sprint has **primary deliverables**, **edge cases to handle**, and **exit criteria**.
2. Edge cases marked 🚨 are **launch blockers** if unresolved.
3. Do not start a sprint until the previous sprint's exit criteria are met (or explicitly waived with a logged decision in DEVELOPMENT_REFERENCE.md).
4. After each sprint, update the **Edge Case Register** at the bottom with any newly discovered gaps.

---

## Sprint Overview

| Sprint | Theme | Outcome |
| ------ | ----- | ------- |
| 0 | Foundation | Runnable monorepo, CI, local dev, observability baseline |
| 1 | Auth & Tenancy | Secure multi-tenant identity, RBAC, tenant isolation |
| 2 | Core Data Model | PostgreSQL schema, migrations, API skeleton |
| 3 | Salesforce Connector | CRM data ingested; customers, ARR, go-live dates |
| 4 | Jira Connector | Tasks, milestones, dependencies ingested |
| 5 | Event Pipeline | Queue, dedup, normalization, replay |
| 6 | Operational Graph | Entity linking SF ↔ Jira ↔ internal model |
| 7 | Risk Engine v1 | Rule-based scoring, evidence, confidence |
| 8 | Slack Connector | Engagement signals, escalation detection |
| 9 | Intelligence Layer | Evidence-constrained LLM explanations |
| 10 | REST API & Cache | Full API surface, Redis, performance |
| 11 | Dashboard & Risk Feed | Executive UI, portfolio metrics |
| 12 | Project Detail & Integrations UI | Drill-down, timeline, connect flows |
| 13 | Notifications | Digest, alerts, preferences |
| 14 | Hardening & Launch Prep | Edge-case sweep, security, pilot readiness |
| 15 | Google Calendar Connector | Meeting frequency / customer engagement signals |
| 16 | Outbound Webhook API | Signed risk event callbacks for customer automation |
| 17 | Recommendation Feedback | Helpful/not helpful ratings → training data |
| 18 | Custom Risk Rules UI | Tenant-defined thresholds and rule toggles |
| 19 | Multi-language UI | en/es/de/fr catalogs + user locale preference |

**Estimated MVP duration:** 28 weeks (14 sprints) + post-MVP integrations

---

## Cross-Cutting Edge Case Categories

These recur across sprints. Each sprint section calls out relevant ones explicitly.

| Category | Examples |
| -------- | -------- |
| **Tenancy** | Cross-tenant leakage, orphaned data, tenant offboarding |
| **Identity** | Token expiry, role conflicts, user removed mid-session |
| **Integration** | OAuth refresh failure, rate limits, sandbox vs prod, partial connect |
| **Data quality** | Missing fields, duplicate records, stale data, wrong mappings |
| **Time** | Timezones, weekends/holidays, clock skew, backdated events |
| **Graph** | Unlinked entities, circular deps, multiple projects per customer |
| **Risk logic** | False positives/negatives, score flapping, insufficient evidence |
| **AI** | Hallucination, PII in prompts, timeout, cost runaway |
| **UX** | Empty/loading/error states, stale UI, alert fatigue |
| **Compliance** | GDPR export/delete, audit trail, secret handling |

---

## Sprint 0 — Foundation & Dev Environment

**Goal:** Any engineer can clone, run, and deploy the stack locally and to staging.

### Primary Deliverables

- [ ] Monorepo structure (`apps/web`, `apps/api`, `packages/shared`, `packages/db`)
- [ ] Next.js 14+ (App Router) + TypeScript strict mode
- [ ] API service (Node/NestJS or Next.js API routes — pick one, document in Decision Log)
- [ ] Docker Compose: PostgreSQL, Redis, LocalStack (SQS) or BullMQ
- [ ] Environment config (`.env.example`, validation via Zod)
- [ ] CI pipeline: lint, typecheck, unit tests on PR
- [ ] Staging deployment (Vercel + Railway/Fly/ECS — document choice)
- [ ] OpenTelemetry baseline + structured logging (request ID, tenant ID)
- [ ] Health check endpoints (`/health`, `/ready`)

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Secrets committed to repo | Pre-commit hook + gitignore; use secret manager in staging |
| Local DB state drift | Seed script + `make reset` command |
| Different Node/OS versions | `.nvmrc`, engines in package.json |
| CI passes but staging fails | Deploy preview on every PR to staging |
| No request tracing across services | Propagate `X-Request-ID` and `X-Tenant-ID` from day one |

### Exit Criteria

- [ ] `docker compose up` + `pnpm dev` runs web + API + DB locally
- [ ] CI green on empty scaffold
- [ ] Staging URL accessible with health check returning 200

---

## Sprint 1 — Auth, Tenancy & RBAC

**Goal:** Users can sign up, belong to a tenant, and access only their tenant's data.

### Primary Deliverables

- [ ] Clerk or Auth0 integration (web + API JWT validation)
- [ ] `tenants` table + tenant creation on first org signup
- [ ] `users` table synced from auth provider (webhook)
- [ ] Roles: `executive`, `operational`, `contributor`, `admin`
- [ ] Row-level security (RLS) policies on PostgreSQL OR middleware tenant scoping
- [ ] Tenant context middleware on every API request
- [ ] Invite flow (admin invites user to tenant)
- [ ] Basic settings page shell (profile, org name)

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Cross-tenant data access | Integration tests that assert tenant A cannot read tenant B; RLS on every table |
| User belongs to multiple orgs | Tenant switcher in UI; JWT/session stores active `tenant_id` |
| User removed from tenant while logged in | Next API call returns 403; redirect to tenant picker |
| Role changed mid-session | Re-fetch permissions on sensitive actions; short JWT TTL |
| Orphan tenant with no admin | Seed first user as admin; document recovery via support |
| Auth webhook delivery failure | Retry queue + manual sync endpoint for admins |
| SSO not configured (MVP) | Document as post-MVP; email/password + Google OAuth only for now |
| Tenant deletion request (GDPR) | Soft-delete flag + 30-day retention policy stub (full purge Sprint 14) |

### Exit Criteria

- [ ] Two test tenants created; zero cross-tenant reads in automated tests
- [ ] RBAC enforced: contributor cannot access admin settings
- [ ] Auth flow works end-to-end in staging

---

## Sprint 2 — Core Data Model & API Skeleton

**Goal:** Canonical schema exists; CRUD APIs for core entities with tenant isolation.

### Primary Deliverables

- [ ] Migrations for: `customers`, `projects`, `milestones`, `tasks`, `events`, `risks`, `recommendations`, `integrations`, `integration_mappings`
- [ ] Shared TypeScript types in `packages/shared`
- [ ] API routes with pagination, filtering, sorting conventions
- [ ] Idempotency key support on write endpoints (header: `Idempotency-Key`)
- [ ] API error format (RFC 7807 Problem Details)
- [ ] OpenAPI spec generated and published
- [ ] Database indexes on `tenant_id`, foreign keys, common query paths

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Missing `tenant_id` on insert | DB constraint NOT NULL + middleware enforcement |
| Duplicate external IDs per integration | Unique constraint on `(tenant_id, source, external_id)` |
| Soft-delete vs hard-delete | `deleted_at` on projects/customers; exclude from active counts |
| Pagination on large datasets | Cursor-based pagination; max page size 100 |
| API returns empty vs 404 | List endpoints return `[]`; single resource returns 404 |
| Migration rollback | Every migration has `down`; test in CI |
| Enum drift (Jira status names) | Store raw status as string; map via config table |
| Currency on ARR | Store `amount` + `currency_code`; display with locale |

### Exit Criteria

- [ ] All core tables migrated with RLS
- [ ] OpenAPI spec covers skeleton CRUD
- [ ] Pagination and error format documented

---

## Sprint 3 — Salesforce Connector

**Goal:** Connect Salesforce; import customers, opportunities, ARR, go-live dates, owners.

### Primary Deliverables

- [ ] OAuth2 connect flow (production + sandbox toggle)
- [ ] Store encrypted refresh tokens per tenant
- [ ] Initial bulk sync job (Opportunities in implementation stage)
- [ ] Incremental sync via polling (Change Data Capture or `SystemModstamp` polling for MVP)
- [ ] Field mapping config (default + tenant overrides for custom fields)
- [ ] Map SF Account/Opportunity → `customers` + `projects`
- [ ] Integration health status (`connected`, `degraded`, `disconnected`, `syncing`)
- [ ] Integrations UI: Connect Salesforce button + sync status

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 OAuth token expired/revoked | Auto-refresh; on failure mark integration `degraded` + notify admin |
| Salesforce sandbox vs production | Explicit environment selector at connect; never mix credentials |
| Missing custom fields (go-live, ARR) | Mapping UI shows unmapped required fields; block "sync complete" until mapped |
| Multiple opportunities per account | Create one project per opportunity OR config: "primary opportunity" rule — document default |
| Opportunity closed/lost still syncing | Filter by stage/status; exclude closed-won implementations that went live |
| No go-live date on opportunity | Flag project as `incomplete_data`; exclude from delay prediction; show in UI |
| ARR = 0 or null | Show "ARR unknown"; exclude from revenue totals with footnote |
| Rate limiting (SF API limits) | Exponential backoff; batch requests; surface "sync delayed" in UI |
| Initial sync takes >30 min | Progress bar with record count; background job; email on completion |
| Duplicate sync runs | Job locking (advisory lock or Redis lock) |
| Wrong SF org connected | Allow disconnect + reconnect; audit log entry |
| Customer name changes in SF | Upsert by `external_id`; update display name |
| Multi-currency orgs | Store currency per opportunity; no silent USD conversion |

### Exit Criteria

- [ ] Connect SF sandbox; bulk import completes with progress UI
- [ ] At least 10 opportunities imported as projects with mapped fields
- [ ] Token refresh works after simulated expiry
- [ ] Integration health visible in UI

---

## Sprint 4 — Jira Connector

**Goal:** Import epics, stories, tasks, statuses, assignees, dependencies from Jira.

### Primary Deliverables

- [ ] Jira OAuth2 connect flow (Cloud; document Server/Data Center as post-MVP)
- [ ] Bulk sync: projects, epics, issues, links (blocks/is blocked by)
- [ ] Webhook registration for issue updates (with polling fallback)
- [ ] Map Jira Epic → `milestones`; Story/Task → `tasks`
- [ ] Store assignee, status, due dates, priority, labels
- [ ] Project mapping UI: link Jira project ↔ Beacon project (manual + suggested match by name)
- [ ] Dependency graph stored (blocked-by relationships)

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Jira project not mapped to any Beacon project | Orphan bucket in admin UI; risks not computed until mapped |
| Jira uses custom issue types (not Epic/Story) | Configurable issue type → entity mapping per tenant |
| Custom workflow statuses | Status category mapping (To Do / In Progress / Done); don't hardcode "Done" |
| Unassigned issues | Flag as `missing_owner` signal; don't crash risk engine |
| Circular dependencies (A blocks B blocks A) | Detect cycle; log warning; break cycle for graph traversal |
| Epic with zero child issues | Milestone exists but no tasks; flag "no breakdown" medium risk |
| Issue deleted in Jira | Soft-delete task; emit `task_deleted` event |
| Issue moved between projects | Reconcile by `external_id`; update project association |
| Webhook missed (Jira downtime) | Nightly reconciliation poll |
| Jira rate limits | Queue throttling; prioritize webhook over bulk |
| Duplicate issue keys after project migration | Trust `external_id` (Jira internal ID), not issue key |
| Subtasks vs stories | Map subtasks as tasks under parent milestone |
| "Done" but blocked downstream | Status alone insufficient; check dependency completion |

### Exit Criteria

- [ ] Jira connected; epics/tasks imported for mapped projects
- [ ] Webhook update reflected within 5 minutes (or polling fallback documented)
- [ ] Project mapping UI functional
- [ ] Dependency relationships queryable

---

## Sprint 5 — Event Ingestion Pipeline

**Goal:** Reliable, deduplicated event stream from all integrations into normalized storage.

### Primary Deliverables

- [ ] SQS/BullMQ queue with dead-letter queue (DLQ)
- [ ] Canonical event schema (versioned: `event_schema_version`)
- [ ] Event processor workers (horizontally scalable)
- [ ] Deduplication via `(tenant_id, source, external_event_id)` or content hash
- [ ] Event types: `task_updated`, `task_completed`, `milestone_updated`, `customer_updated`, `slack_message`, `integration_health`
- [ ] Replay tool for DLQ messages (admin only)
- [ ] Ingestion metrics: throughput, lag, error rate

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Duplicate events (webhook + poll) | Idempotent upsert; dedup table with TTL |
| Out-of-order events | Use `source_updated_at` not `received_at` for ordering |
| Poison message (malformed JSON) | After 3 retries → DLQ; alert on DLQ depth |
| Queue backlog during bulk sync | Separate queues: `realtime` vs `bulk`; prioritize realtime |
| Event schema change | Version field; processors handle v1 and v2 during migration |
| Clock skew (future timestamps) | Clamp to `now()` + log anomaly |
| Partial event payload | Validate required fields; reject with structured error to DLQ |
| Worker crash mid-processing | At-least-once delivery; idempotent handlers |
| Tenant disconnected mid-stream | Drop events for disconnected integrations; don't error loop |
| Huge burst (1000 webhooks/min) | Auto-scale workers; backpressure to integrations |

### Exit Criteria

- [ ] Events flow from SF/Jira webhooks/poll into `events` table
- [ ] Dedup tested: same event twice = one row
- [ ] DLQ replay works
- [ ] Ingestion lag < 2 min under normal load

---

## Sprint 6 — Operational Graph & Entity Resolution

**Goal:** Unified graph linking customers → projects → milestones → tasks → owners → dependencies → revenue.

### Primary Deliverables

- [x] Graph builder service (PostgreSQL adjacency; Neo4j deferred)
- [ ] Entity resolution: match owners across SF (user) ↔ Jira (assignee) ↔ Slack (user ID) by email
- [ ] Project lifecycle states: `active`, `on_hold`, `completed`, `cancelled`
- [ ] Graph rebuild job (full + incremental)
- [ ] Graph query API: dependencies, blockers, owner workload
- [ ] Confidence score on entity links (auto vs manual mapping)

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 SF customer not linked to Jira project | Manual mapping required; show "unlinked project" warning |
| Same person, different emails (contractor) | Fuzzy match suggestions; manual merge in admin |
| One customer, multiple active implementations | Separate project nodes; aggregate at customer level in dashboard |
| Completed project still receiving Jira updates | Auto-transition to `completed` when go-live passed + all milestones done |
| Project on hold | Exclude from risk scoring OR use `on_hold` rules (no activity ≠ risk) |
| Go-live date in the past, project still active | High signal: "past due go-live"; distinct risk rule |
| Orphan tasks (no milestone parent) | Attach to default milestone or project root |
| Revenue linked to wrong project | Single source of truth: SF opportunity ARR only |
| Graph stale after mapping change | Trigger incremental rebuild on mapping update |
| Circular dependency in graph | Tarjan's algorithm or depth limit; surface in UI |
| Entity merge (duplicate customers) | Admin merge tool; reassign all projects |

### Exit Criteria

- [ ] Graph built for 5+ linked projects end-to-end
- [ ] Dependency chain query returns blockers in < 500ms
- [ ] Manual project mapping resolves orphan data
- [ ] On-hold and completed projects excluded from active portfolio

---

## Sprint 7 — Risk Engine v1

**Goal:** Rule-based risk detection with evidence, scores, and confidence levels.

### Primary Deliverables

- [ ] Rule engine (configurable rules per tenant with sensible defaults)
- [ ] MVP rules implemented (see DEVELOPMENT_REFERENCE.md)
- [ ] Risk score 0–100 + level (`low`, `medium`, `high`, `critical`)
- [ ] Evidence array on every risk (source, signal, timestamp, deep link)
- [ ] Confidence score (based on data completeness)
- [ ] Risk lifecycle: `open`, `acknowledged`, `resolved`, `snoozed`
- [ ] Scheduled re-evaluation (every 6 hours + on event)
- [ ] Risk aggregation: multiple rules → composite score with primary reason

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Risk with no evidence | Block emission; log error — never show orphan risk |
| False positive: planned customer wait | `on_hold` / `waiting_on_customer` label in Jira suppresses activity rule |
| False positive: weekends | Activity rules use business days (Mon–Fri, tenant timezone) |
| False positive: holiday season | Configurable blackout periods per tenant |
| Score flapping (79→81→79) | Hysteresis: alert on crossing up; clear on crossing down minus buffer |
| Insufficient data (no Jira connected) | Low confidence badge; fewer rules applied; UI explains gaps |
| All rules fire at once | Rank by severity; show top 3 in feed; full list on detail page |
| Project with no go-live date | Cannot compute delay estimate; show risk without "days delayed" |
| Snoozed risk resurfaces | Respect snooze until date; re-evaluate after |
| User marks risk as false positive | `acknowledged` + feedback stored for future ML; don't re-alert same rule for 7 days |
| Delay estimate without history | Use rule-based defaults (e.g., 14 days for security review stall) |
| Critical dependency undefined | Only flag deps marked critical in Jira (label or priority) |
| Internal vs customer delay attribution | Check assignee domain / Jira label `customer-facing` |

### Exit Criteria

- [ ] All MVP rules implemented with evidence
- [ ] Risk feed populated from real/synced data
- [ ] Snooze and acknowledge flows work
- [ ] Business-day logic tested across timezones

---

## Sprint 8 — Slack Connector

**Goal:** Ingest channel activity; detect engagement gaps and escalation signals.

### Primary Deliverables

- [ ] Slack OAuth (bot + user scopes documented)
- [ ] Channel mapping: Slack channel ↔ Beacon project (manual + auto-suggest by name)
- [ ] Ingest messages, threads, mentions, reactions (metadata only if storing content is restricted)
- [ ] Signals: last customer message date, last internal response, escalation keywords
- [ ] Customer vs internal participant detection (email domain matching)
- [ ] Slack integration health + channel access errors

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Bot not invited to project channel | Mapping UI shows "bot missing"; prompt to `/invite` |
| Private channels without access | List inaccessible mapped channels; degraded status |
| Slack message retention/delete | Store derived signals (last activity date), not full message history if policy requires |
| PII in Slack content | Redact before LLM; store minimal metadata for risk rules |
| Customer domain matches internal (agency) | Allow domain override list per project |
| Very active channel (1000+ msgs/day) | Sample/throttle; track last activity timestamp only |
| Slack workspace disconnected | Stop ingestion; retain last known signals with stale badge |
| Wrong channel mapped | Easy unmap/remap; don't delete historical signals |
| Escalation keyword false positives ("urgent" in casual chat) | Require keyword + context (e.g., @exec mention) |
| Multi-workspace customer (rare) | One Slack integration per tenant for MVP |
| Thread vs channel message | Track most recent activity in either |

### Exit Criteria

- [ ] Slack connected; 3+ channels mapped
- [ ] Customer inactivity rule uses Slack signal
- [ ] Bot access errors surfaced in integrations UI

---

## Sprint 9 — Intelligence Layer (LLM)

**Goal:** Generate root cause narratives and recommendations from structured evidence only.

### Primary Deliverables

- [ ] LLM provider abstraction (OpenAI / Anthropic swappable)
- [ ] Prompt templates with evidence injection (no free-form user input to prompt)
- [ ] Output schema: `{ root_cause, recommended_action, suggested_owner, escalation_path, confidence }`
- [ ] Validation: reject LLM output that references evidence IDs not in input
- [ ] Fallback: template-based text when LLM fails/timeouts
- [ ] Cache explanations in Redis (invalidate on new evidence)
- [ ] Cost controls: max tokens, rate limit per tenant/day
- [ ] Admin toggle: disable LLM (rules-only mode)

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 LLM hallucinates cause not in evidence | Output validator; strip invalid; fall back to rule reason |
| Prompt injection via Slack/Jira text | Sanitize evidence; truncate; never pass raw user HTML |
| PII sent to LLM | Redact emails/names in prompt OR use provider with zero-retention |
| LLM timeout (>10s) | Return rule-based explanation; async retry |
| Stale cached explanation after new event | Cache key includes evidence hash; TTL 1 hour max |
| Token limit exceeded (large project) | Top-N evidence by severity; summarize in pre-processing |
| LLM cost runaway | Daily cap per tenant; degrade to templates |
| Non-English content in sources | LLM instructed to respond in tenant locale (default en) |
| Conflicting evidence | Prompt asks to state primary blocker; list secondary |
| User distrusts AI | "Why this recommendation" expandable with evidence links |
| Same risk, regenerated different text | Stable sort evidence; temperature 0 for consistency |

### Exit Criteria

- [ ] Every insight links to ≥1 evidence item
- [ ] Hallucination test suite passes ( fabricated evidence rejected)
- [ ] Fallback works with LLM disabled
- [ ] P95 generation < 8s

---

## Sprint 10 — REST API Completion & Caching

**Goal:** Full MVP API surface, performant and documented.

### Primary Deliverables

- [ ] `GET /projects` — list with health summary, filters (status, risk level, owner)
- [ ] `GET /projects/:id` — full detail
- [ ] `GET /risks` — feed with pagination, filters
- [ ] `GET /projects/:id/insights` — root cause + recommendations
- [ ] `GET /revenue-impact` — portfolio + per-project breakdown
- [ ] `PATCH /risks/:id` — acknowledge, snooze, resolve
- [ ] Redis caching for dashboard aggregates (TTL 60s)
- [ ] Cache invalidation on event processing
- [ ] API rate limiting per tenant (100 req/min default)
- [ ] OpenAPI spec complete; Postman collection

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Stale cache after risk update | Event-driven invalidation; `Cache-Control` headers |
| Revenue double-counted | Dedupe by project; never sum customer-level ARR twice |
| Empty portfolio | Return zeros with metadata, not 404 |
| Filter combo returns huge result | Enforce max limit; return `has_more` |
| Concurrent risk status updates | Optimistic locking (`version` field) |
| API abuse | Rate limit + 429 with `Retry-After` |
| Deep pagination performance | Cursor on `(created_at, id)` indexed |
| Contributor sees all projects? | RBAC: contributors see assigned projects only (filter in query) |
| Export for exec (CSV) | Optional `?format=csv` on projects/risks — basic for MVP |

### Exit Criteria

- [ ] All endpoints documented and tested
- [ ] Dashboard API p95 < 500ms (cached)
- [ ] Rate limiting and RBAC integration tests pass

---

## Sprint 11 — Executive Dashboard & Risk Feed UI

**Goal:** Leadership sees portfolio health at a glance.

### Primary Deliverables

- [ ] Implementation Risk Center dashboard ([marketing_copy.md](./marketing_copy.md) copy)
- [ ] Portfolio metrics: Active, At Risk, Revenue Delayed, Avg Time-to-Go-Live, Confidence, Trend
- [ ] Risk feed page: cards with customer, level, delay, revenue, root cause, action
- [ ] Filters: risk level, owner, date range
- [ ] Empty state: "Good news. No implementation risks detected."
- [ ] Loading skeleton during sync
- [ ] Stale data indicator ("Last updated 12 min ago")
- [ ] Responsive layout (tablet minimum for exec review)

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Initial sync not complete | Full-page progress; disable risk feed until min data threshold |
| Zero integrations connected | Redirect to integrations setup wizard |
| ARR unknown projects | Show count separately; footnote on revenue metric |
| Trend with <7 days data | Show "Insufficient history" not misleading chart |
| 100+ at-risk projects | Paginated feed; summary still shows totals |
| Risk level color-only indicator | Icons + text for colorblind accessibility |
| User timezone | Display dates in user locale/timezone |
| Dashboard error (API down) | Error boundary with retry; don't show stale as fresh |
| Print/export for board meeting | Basic print stylesheet |

### Exit Criteria

- [ ] Dashboard loads < 3s with cached API
- [ ] All empty/loading/error states implemented
- [ ] Copy matches marketing_copy.md

---

## Sprint 12 — Project Detail, Timeline & Integrations UI

**Goal:** Drill-down from portfolio to actionable project intelligence.

### Primary Deliverables

- [ ] Project detail page: overview, health, risks, actions, timeline
- [ ] Unified activity timeline (SF + Jira + Slack events merged, sorted)
- [ ] Evidence deep links (open in Jira, SF, Slack)
- [ ] Integrations management page (connect, disconnect, remap, health)
- [ ] Field mapping UI for Salesforce custom fields
- [ ] Project ↔ Jira ↔ Slack mapping UI
- [ ] Onboarding wizard: connect → map → sync → dashboard

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Timeline out of order | Sort by `occurred_at`; show source icon |
| Missing deep link (record deleted) | Gray link + "Source record unavailable" |
| Project with incomplete mapping | Banner: "Risk analysis incomplete — finish setup" |
| Disconnect integration | Confirm dialog; explain data retention policy |
| Reconnect different SF org | Warn: existing mappings may break |
| Very long timeline (1000+ events) | Virtualized list; default last 30 days |
| Acknowledge/snooze from detail page | Optimistic UI with rollback on failure |
| Multiple open risks on one project | Grouped by category |
| Go-live date edited in SF | Timeline shows field change event |

### Exit Criteria

- [ ] End-to-end onboarding wizard completable in staging
- [ ] Project detail shows evidence-backed risks with links
- [ ] Integration remapping doesn't corrupt graph (rebuild verified)

---

## Sprint 13 — Notifications

**Goal:** Proactive alerts without alert fatigue.

### Primary Deliverables

- [ ] Email daily digest (per user timezone, default 8am)
- [ ] Immediate email/Slack alert on high/critical risk threshold cross
- [ ] Notification preferences (channel, frequency, min severity)
- [ ] Digest content: count, revenue impact, top 3 risks, CTA link
- [ ] In-app notification center (bell icon)
- [ ] Unsubscribe link (one-click, per notification type)

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Alert fatigue (same risk daily) | Don't repeat unchanged risks in digest; only new/escalated |
| Duplicate immediate alerts | Debounce: max 1 alert per risk per 24h unless severity increases |
| User timezone | Digest sent at local 8am; store timezone in profile |
| Email bounce | Mark email invalid; fall back to in-app only |
| User on vacation | Snooze all notifications (global snooze setting) |
| Slack alert to customer channel by mistake | MVP: internal Slack/webhook only; never post to customer channels |
| Tenant admin disables notifications org-wide | Override user prefs |
| Risk resolved between digest compile and send | Filter at send time |
| No risks → skip digest | Optional "all clear" weekly summary (off by default) |
| Immediate alert for low confidence risk | Min confidence threshold for alerts (configurable) |

### Exit Criteria

- [ ] Daily digest sends correctly in staging (test cron)
- [ ] Threshold alert fires once per escalation
- [ ] Preferences respected in all channels

---

## Sprint 14 — Hardening, Security & Launch Prep

**Goal:** Production-ready for 3 pilot customers.

### Primary Deliverables

- [ ] Security review: OWASP top 10, dependency audit, secret rotation
- [ ] GDPR: data export (JSON) + deletion request flow
- [ ] Audit log: integration connect/disconnect, mapping changes, risk acknowledgments
- [ ] Load test: 50 projects, 10K tasks, 100K events/tenant
- [ ] Runbook: integration failure, queue backlog, DB failover
- [ ] Backup + restore drill (PostgreSQL PITR)
- [ ] Feature flags for risky features (LLM, Slack alerts)
- [ ] Pilot onboarding checklist + support playbook
- [x] Google Calendar connector — moved to Sprint 15

### Edge Cases to Address

| Edge case | Handling |
| --------- | -------- |
| 🚨 Production data leak in logs | Scrub PII/tokens from logs; log audit only |
| Tenant offboarding | Full data purge within 30 days; documented |
| Disaster recovery | RTO 4h, RPO 1h documented and tested |
| LLM provider outage | Automatic fallback to templates |
| All integrations down | Dashboard shows "data stale" not empty risks |
| Pilot customer custom SF schema | Field mapping self-serve verified |
| Pen test finding | Track in security backlog; block launch on critical |
| Legal: DPA template ready | Static page + acceptance flow |

### Exit Criteria

- [ ] 3 pilot tenants onboarded on production
- [ ] Load test meets NFR (< 2s API, < 3s dashboard)
- [ ] Security checklist complete
- [ ] MVP exit criteria from DEVELOPMENT_REFERENCE.md assessed

---

## Sprint 15 — Google Calendar Connector ✅

**Goal:** Meeting frequency and customer-attended meeting signals for risk detection.

### Primary Deliverables

- [x] Migration `0013_google_calendar` — `calendar_project_signals`, `project_to_calendar` mapping type
- [x] OAuth + mock-connect integration service (dev parity with Slack/Jira)
- [x] Sync job — meetings → signals + `calendar_meeting` canonical events
- [x] Risk engine hooks — inactivity / customer engagement gap fallback
- [x] Integrations UI — connect, calendar→project mapping, sync, disconnect
- [x] API routes + shared signal computation + tests

### Exit Criteria

- [x] Mock connect + sync produces signals for mapped projects
- [x] Risk context includes calendar signals in `lastActivityAt`
- [x] Build and unit tests pass

---

## Sprint 16 — Outbound Webhook API ✅

**Goal:** Let customers receive signed HTTP callbacks when implementation risks change.

### Primary Deliverables

- [x] Migration `0014_outbound_webhooks` — subscriptions + delivery log
- [x] HMAC-SHA256 signing (`X-Beacon-Signature` headers)
- [x] Event types: `risk.created`, `risk.updated`, `risk.escalated`, `risk.resolved`, `ping`
- [x] Dispatch from risk engine + manual risk resolution
- [x] Admin CRUD API, test ping, secret rotation, delivery history
- [x] Tenant feature flag `outboundWebhooksEnabled`
- [x] Settings UI for webhook management

### Exit Criteria

- [x] Admin can create subscription and receive signed test ping
- [x] Risk evaluation emits webhook events to enabled subscriptions
- [x] Failed deliveries logged; subscription auto-disabled after repeated failures
- [x] Build and unit tests pass

---

## Sprint 17 — Recommendation Feedback Loop ✅

**Goal:** Capture user ratings on AI explanations and recommendations for future ML training.

### Primary Deliverables

- [x] Migration `0015_recommendation_feedback` — feedback table with unique per-user targets
- [x] POST/GET feedback API + admin summary and training export
- [x] Sync recommendation status from feedback (accepted/dismissed)
- [x] Project detail UI — Helpful / Not helpful on AI explanation panel
- [x] Admin feedback summary in compliance settings

### Exit Criteria

- [x] User can rate insight and update rating
- [x] Admin can view summary and export training rows
- [x] Build and unit tests pass

---

## Sprint 18 — Custom Risk Rules UI ✅

**Goal:** Let tenant admins configure rule thresholds and severity without engineering changes.

### Primary Deliverables

- [x] Shared rule definitions, merge/patch helpers, API response builder
- [x] GET/PATCH/reset `/v1/admin/risk-rules` using `tenants.risk_settings`
- [x] Audit log on rule changes; background re-evaluation after save
- [x] Settings UI — per-rule toggles, severity, score, thresholds
- [x] Global tuning: timezone, hysteresis, acknowledged suppression

### Exit Criteria

- [x] Admin can disable a rule and change inactivity threshold
- [x] Engine respects updated settings on next evaluation
- [x] Build and unit tests pass

---

## Sprint 19 — Multi-language UI ✅

**Goal:** i18n framework and user locale preference for core web surfaces.

### Primary Deliverables

- [x] Migration `0017_user_locale` — `users.locale` column
- [x] Shared catalog (`en`, `es`, `de`, `fr`) + `translate()` / `normalizeLocale()`
- [x] `PATCH /v1/me/locale` and locale on `/v1/me`
- [x] Web `I18nProvider`, `useTranslation()`, language settings section
- [x] Translated shell nav, dashboard, empty state, settings headers

### Exit Criteria

- [x] User can switch language and see UI update without reload
- [x] Preference persists across sessions
- [x] Build and unit tests pass

---

## Sprint 20 — Portfolio Benchmarking ✅

**Goal:** Cross-tenant anonymized peer comparisons (Stage 2 preview).

### Primary Deliverables

- [x] Migration `0018_benchmarking` — tenant snapshots + cohort percentiles
- [x] Shared benchmark helpers (`percentiles`, comparison builder, k-anonymity)
- [x] `GET /v1/benchmarks/portfolio` + admin refresh/status routes
- [x] Tenant feature flag `benchmarkParticipationEnabled` + `FEATURE_BENCHMARKS_ENABLED`
- [x] Dashboard benchmark comparison panel
- [x] Admin opt-in via feature flags + snapshot refresh UI

### Exit Criteria

- [x] Opted-in tenant sees portfolio metrics vs peer percentiles
- [x] Cohort data suppressed below 3-tenant k-anonymity threshold
- [x] Build and unit tests pass

---

## Sprint 21 — Predicted Delay Confidence Intervals ✅

**Goal:** Show estimated go-live slip with confidence intervals using risk signals and peer baseline dispersion.

### Primary Deliverables

- [x] Shared delay prediction model (`computeDelayPrediction`)
- [x] `GET /v1/projects/:projectId/delay-prediction`
- [x] Peer benchmark dispersion feeds uncertainty band when cohort ≥3 tenants
- [x] Tenant feature flag `delayPredictionsEnabled` + `FEATURE_DELAY_PREDICTIONS_ENABLED`
- [x] Project detail delay prediction panel (range, on-time probability, basis)

### Exit Criteria

- [x] Active project with go-live date returns predicted delay + 80% CI
- [x] Insufficient data handled when go-live date missing
- [x] Build and unit tests pass

---

## Post-MVP Backlog (Sprint 22+)

Not in MVP. Prioritize after pilot feedback.

| Item | Notes |
| ---- | ----- |
| ML risk scoring v2 | Requires historical outcome labels from pilots |
| SSO / SAML | Enterprise deals |
| Mobile app | Responsive web sufficient for MVP |

---

## Edge Case Register

Track discovered gaps during development. Add rows as sprints progress.

| ID | Edge case | Sprint discovered | Status | Resolution |
| -- | --------- | ----------------- | ------ | ---------- |
| EC-001 | Cross-tenant data leakage | 1 | **Resolved** | RLS + `@beacon/db` tests; API isolation tests for projects, risks, dashboard |
| EC-002 | OAuth token refresh failure | 3 | **Resolved** | Degraded status + admin in-app/email alert (TD-005) |
| EC-003 | SF/Jira project not linked | 4, 6 | **Resolved** | Auto-map by name + manual mapping UI; unlinked project blockers + project banner |
| EC-016 | Circular Jira dependencies | 4, 6 | **Resolved** | Cycle detection in graph queries; cyclic edges excluded from risk eval; project UI warning |
| EC-004 | Duplicate webhook events | 5 | **Resolved** | Unified Jira dedupe keys (webhook + sync); DB unique index; ingest returns dedup status + metrics |
| EC-005 | Weekend false positive (inactivity) | 7 | **Resolved** | Business-day counting + skip inactivity eval on non-business days |
| EC-006 | Risk score flapping | 7 | **Resolved** | Configurable hysteresis buffer in risk engine + admin settings UI |
| EC-007 | LLM hallucination | 9 | **Resolved** | Evidence bundle validation rejects unknown IDs; template fallback on LLM failure |
| EC-008 | Bot not in Slack channel | 8 | **Resolved** | Bot access panel + mapping guard (TD-027) |
| EC-009 | Alert fatigue | 13 | **Resolved** | Dedupe keys + daily digest; daily users get batched in-app only; email via digest |
| EC-010 | Initial sync UX (long wait) | 3, 11 | **Resolved** | Progress UI + admin email on first bulk sync (TD-028) |
| EC-011 | Missing ARR / go-live fields | 3 | **Resolved** | `dataComplete` requires ARR + go-live; project banner + dashboard risk feed excludes stale inactive projects |
| EC-012 | On-hold projects flagged at risk | 6, 7 | **Resolved** | Lifecycle guard skips inactive statuses; scheduled eval resolves open risks; dashboard feed active-only |
| EC-013 | Stale dashboard cache | 10 | **Resolved** | Cache invalidated after integration sync (TD-011) |
| EC-014 | Contributor over-permission | 10 | **Resolved** | Project/customer scoping in API; contributor 403 on risk PATCH; read-only UI banners |
| EC-015 | PII in LLM prompts | 9 | **Resolved** | Evidence + prompt field sanitization; Slack message body never stored in events |
| EC-017 | Multi-currency ARR totals | 2, 10 | **Resolved** | Per-currency breakdown; no silent conversion (TD-010) |
| EC-018 | GDPR deletion | 14 | **Resolved** | Export + deletion request API; admin complete/reject workflow; user anonymization |
| EC-019 | Wrong SF org reconnected | 3, 12 | **Resolved** | OAuth callback detects org change; audit + admin notify; setup/integrations warning banner |
| EC-020 | Customer domain = internal domain | 8 | **Resolved** | Per-mapping `domainOverrides` (Slack + GCal); collision warning in status + integrations UI |

---

## Sprint Ceremonies (Recommended)

| Ceremony | When | Output |
| -------- | ---- | ------ |
| Sprint planning | Day 1 | Sprint backlog from this doc + carryover |
| Edge case review | Day 2 | Update Edge Case Register |
| Demo | Day 9 | Stakeholder review against exit criteria |
| Retro | Day 10 | Process improvements; SSOT updates if needed |

---

## Definition of Done (All Sprints)

- [ ] Code reviewed and merged to `main`
- [ ] Unit tests for business logic; integration tests for tenant isolation
- [ ] Edge cases in sprint table addressed or explicitly deferred with EC-ID
- [ ] API documented if endpoints added/changed
- [ ] No 🚨 launch-blocker edge cases left open without waiver
- [ ] Staging deployed and smoke-tested

---

## Starting Sprint 0

When ready to begin implementation, Sprint 0 first actions:

1. Initialize monorepo (`pnpm` workspaces recommended)
2. Scaffold `apps/web` (Next.js) and `apps/api`
3. Add Docker Compose for PostgreSQL + Redis
4. Configure CI on GitHub Actions
5. First PR: health checks + README with local setup

---

*This plan complements [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md). Update both when scope or sequencing changes.*

---

## Technical Debt Reduction

Track and prioritize debt in [TECH_DEBT.md](./TECH_DEBT.md). Allocate ~15–20% of each sprint to debt items mapped in that register.

| Debt sprint | Focus | Status |
| ----------- | ----- | ------ |
| TD-S1 | Auth & API client (TD-001–004, TD-006) | ✅ Complete (2026-06-15) |
| TD-S2 | Notifications & OAuth alerts (TD-003, TD-005) | ✅ Complete (2026-06-15) |
| TD-S3 | Data accuracy & cache (TD-010–012) | ✅ Complete (2026-06-15) |
| TD-S4 | Test pyramid (TD-013–016) | ✅ Complete (2026-06-15) |
| TD-S5 | Integrations hardening (TD-007–009, TD-018) | ✅ Complete (2026-06-15) |
| TD-S6 | Cleanup & edge-case register (TD-021–028) | ✅ Complete (2026-06-15) |
