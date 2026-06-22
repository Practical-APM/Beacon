# Beacon — Development Reference

**Version:** 1.0  
**Status:** Single Source of Truth (SSOT) for all engineering and product development  
**Last updated:** 2026-06-11

---

## How to Use This Document

This file is the **authoritative reference** for building Beacon. When planning, designing, or implementing any feature:

1. **Start here** — not in individual BRD/PRD/TRD files.
2. **Defer to the Product Vision** ([vision.md](./vision.md)) when trade-offs arise.
3. **Respect MVP boundaries** — if a capability is marked out-of-scope, do not build it unless this document is updated first.
4. **Treat linked source docs** as deep-dive supplements, not competing specs.

| Document | Role |
| -------- | ---- |
| [vision.md](./vision.md) | North star, principles, long-term ambition |
| [BRD.md](./BRD.md) | Business case, personas, GTM, pricing |
| [PRD.md](./PRD.md) | MVP product scope, UX, success criteria |
| [TRD.md](./TRD.md) | Architecture, stack, APIs, data model |
| [expansion.md](./expansion.md) | Post-MVP roadmap and moat strategy |
| [marketing_copy.md](./marketing_copy.md) | Positioning, UI copy, messaging constraints |

---

## Product Identity

| Field | Value |
| ----- | ----- |
| **Product name** | Beacon |
| **Tagline** | Datadog for Customer Implementations |
| **One-line vision** | Help B2B companies predict, explain, and prevent implementation delays before revenue is impacted. |
| **Core belief** | Businesses need an **intelligence layer**, not another project management tool. |
| **MVP question** | *Which customer implementations are likely to miss their target go-live date, and why?* |

### What We Are

- A **proactive operational intelligence platform** for implementation risk
- **Workflow-agnostic** — integrates with existing systems, no rip-and-replace
- **Evidence-backed** — every insight must trace to operational signals
- **Revenue-focused** — every insight connects to business impact (ARR delayed, at risk, impacted)

### What We Are Not

Do **not** build or position as:

- Jira, Asana, Monday.com, Rocketlane, GuideCX (project/onboarding management)
- A generic dashboard or reporting tool
- An AI summary layer without traceable evidence
- Workflow automation, resource planning, or churn/revenue forecasting (MVP)

**Competitive framing:** Existing tools answer *"What happened?"* or *"What is happening?"* Beacon answers *"What is about to happen?"*

---

## Product Principles (Non-Negotiable)

These apply to every feature, API, and UI decision:

| Principle | Implementation implication |
| --------- | -------------------------- |
| **Proactive** | Surface risks without users asking; daily digest + threshold alerts |
| **Explainable** | Show evidence (events, dates, sources) behind every risk and recommendation |
| **Executive-friendly** | Portfolio-level visibility first; IC task views secondary |
| **Workflow-agnostic** | Read from external systems; do not replace them |
| **Revenue-focused** | Always show ARR impacted / delayed / at risk where applicable |
| **Intelligence over automation** | Recommend actions; do not auto-execute workflows (MVP) |
| **Human trust before AI** | Rule-based risk detection first; LLM explains with structured evidence only |
| **API-first** | Every capability exposed via REST APIs |

---

## Target Users & Personas

### Executive User (primary dashboard audience)

- COO, CRO, CEO, VP Customer Success
- Needs: portfolio visibility, revenue risk, escalation visibility

### Operational User

- Head of Implementation, PS Director, CSM
- Needs: project health, blockers, recommended actions

### Individual Contributor

- Implementation Manager, Solutions Engineer
- Needs: project-level risk, ownership visibility

### Ideal Customer Profile (MVP GTM)

- B2B SaaS, 50–1,000 employees, $5M–$200M ARR
- Secondary: Fintech, HRMS, ERP, procurement, travel tech, integration platforms

---

## MVP Scope

### In Scope

| Capability | Description |
| ---------- | ----------- |
| **Risk detection** | Delayed, at-risk, and stalled implementations |
| **Root cause detection** | Customer/internal dependency delays, missing ownership, resource constraints, communication gaps |
| **Revenue impact** | ARR impacted, delayed, at risk (from Salesforce) |
| **Action recommendations** | Suggested owner, action, escalation path |
| **Integrations** | Salesforce, Jira, Slack (+ Google Calendar per TRD/marketing) |
| **Executive dashboard** | Portfolio summary metrics |
| **Risk feed** | Datadog-style incident feed of implementation risks |
| **Project detail** | Health, risks, actions, unified activity timeline |
| **Notifications** | Daily digest + immediate alerts on threshold breach |
| **Risk scoring v1** | Rule-based (see below) |

### Explicitly Out of Scope (MVP)

Do not implement until post-MVP:

- Churn prediction
- Revenue forecasting
- AI agents / workflow automation
- Resource planning / capacity forecasting
- ML-based predictive scoring (v2)
- GraphQL API (REST first)
- Multi-module expansion (CS intelligence, revenue intelligence)

**Strategic rule (first 3 years):** Obsess only over implementation intelligence. Resist platform creep.

---

## System Architecture

```
Integrations (Salesforce, Jira, Slack, Google Calendar)
        ↓
Event Ingestion Layer (Kafka / MVP: AWS SQS)
        ↓
Normalization Layer (external objects → internal entities)
        ↓
Operational Graph Engine (Neo4j / alt: PostgreSQL + graph ext)
        ↓
Risk Engine (rule-based v1)
        ↓
Intelligence Engine (LLM explanations from structured evidence)
        ↓
API Layer (REST)
        ↓
Frontend (Next.js + React + TypeScript)
```

### Component Responsibilities

| Layer | Purpose |
| ----- | ------- |
| **Integration** | OAuth2 connectors; webhooks + polling fallback |
| **Ingestion** | Validate, deduplicate, route events |
| **Normalization** | Map SF Opportunity → Customer; Jira Epic → Milestone; Slack → Operational Signal |
| **Graph** | Customer → Implementation → Milestone → Task → Owner → Dependencies → Revenue |
| **Risk Engine** | Apply rules; emit risk scores + reasons |
| **Intelligence** | LLM generates root cause narrative + recommendations from evidence only |
| **API** | REST endpoints for projects, risks, insights, revenue impact |
| **Frontend** | Executive dashboard, risk feed, project detail, integrations, settings |

### Integration Pattern

```
Connector → Webhook → Event Queue → Processor
```

### Event Schema (canonical)

```json
{
  "event_type": "task_completed",
  "project_id": "123",
  "source": "jira",
  "timestamp": "ISO-8601"
}
```

---

## Technology Stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| **Frontend** | Next.js, React, TypeScript | shadcn/ui + TailwindCSS |
| **API** | REST (GraphQL later) | API-first platform |
| **Primary DB** | PostgreSQL | Tenants, users, projects, events, risks, recommendations |
| **Graph** | Neo4j (alt: PG + graph extension) | Dependency/root-cause/impact analysis |
| **Cache** | Redis | Risk feed, dashboard queries, exec reports |
| **Queue** | Kafka (MVP alt: AWS SQS) | Event ingestion |
| **Auth** | Clerk or Auth0 | RBAC authorization |
| **Observability** | Datadog + OpenTelemetry | API latency, throughput, integration health |
| **LLM** | GPT / Claude / Gemini | Structured evidence in; explanations out — no hallucinations |

### Security & Compliance

- Multi-tenant with row-level security (tenant → projects → users)
- Encryption: AES-256 at rest, TLS 1.3 in transit
- SOC2-ready architecture, GDPR-ready data handling
- Future: dedicated enterprise deployments

### Non-Functional Requirements

| Metric | Target |
| ------ | ------ |
| API response time | < 2s |
| Dashboard load | < 3s |
| Availability | 99.9% |

### Scalability Targets

| Horizon | Customers | Event volume |
| ------- | --------- | ------------ |
| Year 1 | 100 | — |
| Year 2 | 1,000 | — |
| Year 3 | 10,000 | 100M+ events/month |

---

## Data Model

### PostgreSQL Tables

`tenants`, `users`, `projects`, `customers`, `milestones`, `tasks`, `events`, `risks`, `recommendations`

### Operational Graph (relationships)

```
Customer
  └── Implementation (Project)
        └── Milestone
              └── Task
                    └── Owner
                          └── Dependencies
                                └── Revenue (ARR)
```

### Normalization Mapping

| External source | Internal entity |
| --------------- | --------------- |
| Salesforce Opportunity | Customer |
| Salesforce Account / ARR fields | Customer + Revenue |
| Jira Epic | Milestone |
| Jira Story/Task | Task |
| Slack channel/thread | Operational Signal |
| Google Calendar meeting | Engagement signal |

### Integration Data Requirements

**Salesforce:** Opportunities, customers, ARR, target go-live date, customer owner  
**Jira:** Epics, stories, tasks, status, assignee, dependencies, sprint activity  
**Slack:** Channels, messages, mentions, escalations  
**Google Calendar:** Meetings, participants, meeting frequency

---

## Risk Engine (v1 — Rule-Based)

MVP uses deterministic rules. ML scoring is v2+.

| Condition | Risk level |
| --------- | ---------- |
| No project activity for 10+ days | **High** |
| Critical dependency overdue | **High** |
| No assigned owner | **High** |
| Customer response delay (14+ days inactive) | **Medium** |
| Milestone completion behind schedule | **Medium** |

### Risk Output Schema

```json
{
  "risk_score": 85,
  "reason": "Customer dependency overdue",
  "level": "high",
  "evidence": [
    { "source": "jira", "signal": "dependency_overdue", "days": 12 }
  ]
}
```

### Intelligence Engine Constraints

- **Input:** Risk score, graph relationships, event history (structured)
- **Output:** Root cause narrative, recommended action, impact assessment
- **Rule:** Prompt with structured evidence only; no speculative or hallucinated causes

---

## API Surface (MVP)

| Endpoint | Purpose |
| -------- | ------- |
| `GET /projects` | List implementations with health summary |
| `GET /projects/:id` | Project detail (health, risks, timeline) |
| `GET /risks` | Risk feed (filterable by level, status) |
| `GET /insights` | Root cause + recommendations |
| `GET /revenue-impact` | Portfolio and per-project ARR impact |

Auth: tenant-scoped, RBAC by role (executive, operational, IC).

---

## Frontend Pages & UX

### Pages

1. **Executive Dashboard** — Implementation Risk Center
2. **Risk Feed** — Projects Requiring Attention
3. **Project Detail** — Implementation Health
4. **Integrations** — Connect Salesforce, Jira, Slack, Google Calendar
5. **Settings** — Users, roles, notification preferences

### First-Login Flow

1. User connects Salesforce, Jira, Slack (and optionally Google Calendar)
2. System imports implementation data
3. System builds implementation graph
4. System calculates initial risk scores
5. User lands on portfolio dashboard

### Executive Dashboard Metrics

- Active Implementations
- At Risk
- Revenue Delayed
- Average Time To Go-Live
- Go-Live Confidence Score
- Risk Trend

### Risk Feed Card (template)

```
[Customer Name] — High Risk
Potential Delay: 14 days
Revenue Impact: $45,000
Root Cause: Security review inactive for 18 days
Suggested Action: Escalate to customer security owner
```

### Project Detail Sections

1. **Overview** — Customer, owner, go-live date, ARR
2. **Health Summary** — Risk score, trend, confidence
3. **Detected Risks** — List of identified issues with evidence
4. **Recommended Actions** — Owner, action, escalation path
5. **Activity Timeline** — Unified feed from Salesforce, Jira, Slack

### Empty State

> Good news. No implementation risks detected. All active projects are progressing within expected thresholds.

---

## Messaging & UI Copy Constraints

From [marketing_copy.md](./marketing_copy.md) — use in product UI and external comms:

**Lead with the pain, not the category:**

- ✅ *Know which implementations will miss go-live before they miss go-live.*
- ❌ "AI-powered operational intelligence platform"

**Dashboard header:** Implementation Risk Center  
**Dashboard subheading:** Monitor implementation health, revenue impact, and delivery risk across all active customers.

**Positioning:** Unlike PM tools that track work, Beacon tells leadership what is likely to go wrong and what to do.

---

## Notifications

### Daily Digest

- Subject pattern: *"N Customer Implementations Need Attention"*
- Include: count at risk, total revenue impact, top risk themes, link to recommendations

### Immediate Alerts

- Trigger when risk score crosses configured threshold
- Include evidence summary and suggested action

---

## Success Metrics

### MVP Exit Criteria

- 10 customers actively using the platform
- Risk predictions trusted by users
- Customers report reduced implementation delays
- Renewal intent > 80%

### Product Metrics (targets)

| Metric | Target |
| ------ | ------ |
| Risk detection accuracy | 80–85% |
| Recommendation acceptance rate | 60% |
| Weekly active usage | 70% |
| Executive retention | 85% |

### Customer Outcome Metrics (targets)

| Metric | Target |
| ------ | ------ |
| Reduction in delays | 25–30% |
| Faster time-to-go-live | 20% |
| Reduced executive escalations | 25% |

### Business Validation Gate (pre full build)

Proceed to major engineering investment only if:

- 30+ customer interviews validate pain
- 10 design partners commit
- 3 customers agree to pilot
- Measurable ROI demonstrated

---

## Development Phases

### Phase 1 — MVP (Now)

**Goal:** Answer the MVP question reliably.

| Workstream | Deliverables |
| ---------- | ------------ |
| Integrations | Salesforce + Jira + Slack (+ Google Calendar) |
| Ingestion | Event queue, normalization, deduplication |
| Graph | Customer → project → milestone → task → owner → deps |
| Risk | Rule-based engine + risk feed |
| Intelligence | Evidence-constrained LLM explanations |
| API | REST endpoints (projects, risks, insights, revenue) |
| Frontend | Dashboard, risk feed, project detail, integrations |
| Auth & tenancy | Multi-tenant RBAC |
| Notifications | Daily digest + threshold alerts |

**Phase 1 integrations (strict):** Salesforce, Jira, Slack only for initial connector work; Google Calendar follows immediately after core trio is stable.

### Phase 2 — Predictive Intelligence

- Historical analysis across completed implementations
- ML-based risk scoring
- Cross-project pattern detection

### Phase 3 — Expansion (see [expansion.md](./expansion.md))

| Stage | Focus | Timeline |
| ----- | ----- | -------- |
| 1 | Implementation risk intelligence | 0–18 mo |
| 2 | Implementation benchmarking network | 12–24 mo |
| 3 | Customer success intelligence | 18–36 mo |
| 4 | Revenue intelligence | 30–48 mo |
| 5 | Operational intelligence platform | 48–72 mo |
| 6 | Business operating system | 72–120 mo |

**Do not start Phase 2+ work until Phase 1 MVP exit criteria are met.**

---

## Moat & Strategic Assets

Build these intentionally from day one:

1. **Operational graph** — proprietary relationship layer (core moat)
2. **Historical implementation dataset** — fuels benchmarking and ML later
3. **Integration breadth** — weak moat alone; necessary foundation
4. **Benchmark network** — strong moat at Stage 2+
5. **Predictive models** — strong moat at Stage 4+

---

## Failure Modes to Avoid

| Failure | Guardrail |
| ------- | --------- |
| Becoming a PM tool | No task creation/editing in external systems; intelligence only |
| Becoming a dashboard company | Proactive alerts + recommendations, not passive charts |
| Expanding too early | MVP scope lock; update this doc before adding modules |
| AI without evidence | Every LLM output must cite structured signals |
| Integration sprawl | 3 core integrations first; add only with customer demand |

---

## Long-Term Vision (Context Only — Not MVP Work)

From [vision.md](./vision.md):

> *A COO starts their day and sees 3 implementations at risk, ₹1.4 Cr ARR delayed, root causes identified, recommended actions generated — no meetings, no dashboards, no manual investigation.*

End state: **Business Operating System** — the default intelligence layer for operational decision-making.

**10-year success signal:** Leaders ask *"What does Beacon recommend we do?"* instead of *"Can we see the dashboard?"*

---

## Decision Log Template

When deviating from this document, record decisions here:

| Date | Decision | Rationale | Approved by |
| ---- | -------- | --------- | ----------- |
| — | — | — | — |

---

## Quick Reference Checklist (Pre-Ship)

Before merging any feature:

- [ ] Does it serve the MVP question (go-live risk + why)?
- [ ] Is it backed by traceable evidence from integrated systems?
- [ ] Does it show revenue impact where applicable?
- [ ] Is it tenant-isolated and RBAC-compliant?
- [ ] Does it avoid out-of-scope capabilities (automation, churn, forecasting)?
- [ ] Are API endpoints exposed for the capability?
- [ ] Does UI copy follow [marketing_copy.md](./marketing_copy.md) tone?
- [ ] Are NFR targets met (< 2s API, < 3s dashboard)?

---

*This document supersedes conflicting details in source docs. Update this file first when scope, architecture, or priorities change.*
