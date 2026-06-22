# Beacon

# Technical Requirements Document (TRD)

Version: 1.0

Owner: Engineering Team

Status: Architecture Definition

> **Implementation reality (2026-06):** The shipped MVP uses **PostgreSQL** (including adjacency-list graph tables with RLS), **Redis + BullMQ** for event queues, and **Next.js + Hono**. Kafka and Neo4j below are aspirational alternatives documented for future scale — not current dependencies.

---

# Objective

Build a multi-tenant SaaS platform that continuously ingests operational data from enterprise systems, constructs an implementation intelligence graph, detects project risks, and generates actionable recommendations.

The system must support:

* Near real-time data ingestion
* Risk scoring
* Root cause analysis
* Executive dashboards
* Multi-tenant security

---

# Technical Principles

## Principle 1

Intelligence over Automation

We are not building workflow automation.

We are building operational intelligence.

---

## Principle 2

Evidence First

Every recommendation must have traceable evidence.

---

## Principle 3

Human Trust Before AI

Rule-based intelligence precedes predictive AI.

---

## Principle 4

API-First Platform

Every capability must be exposed through APIs.

---

## Principle 5

Operational Graph Is The Moat

The graph becomes our proprietary intelligence layer.

---

# High-Level Architecture

```text
Integrations
      ↓
Event Ingestion Layer
      ↓
Normalization Layer
      ↓
Operational Graph Engine
      ↓
Risk Engine
      ↓
Intelligence Engine
      ↓
API Layer
      ↓
Frontend
```

---

# System Components

## 1. Integration Layer

Purpose:

Connect external systems.

---

Initial Connectors

### Salesforce

Objects:

* Account
* Opportunity
* Implementation Project
* ARR
* Customer Owner

---

### Jira

Objects:

* Epic
* Story
* Task
* Status
* Assignee

---

### Slack

Objects:

* Channels
* Messages
* Mentions
* Escalations

---

### Google Calendar

Objects:

* Meetings
* Participants
* Meeting Frequency

---

# Integration Architecture

Pattern:

```text
Connector
↓
Webhook
↓
Event Queue
↓
Processor
```

---

Technology

* OAuth2
* Webhooks
* Polling fallback

---

# 2. Event Ingestion Layer

Purpose:

Receive events from integrations.

---

Technology

**Implemented:** Redis + BullMQ job queues (via `@beacon/api` workers)

**Documented alternative (not in MVP):** Kafka or AWS SQS for high-volume multi-region fan-out

---

Events

Examples:

```json
{
  "event_type": "task_completed",
  "project_id": "123",
  "source": "jira",
  "timestamp": "..."
}
```

---

Responsibilities

* Validation
* Deduplication
* Event routing

---

# 3. Normalization Layer

Purpose:

Convert external system objects into internal objects.

---

Example

Salesforce Opportunity

↓

Internal Customer Entity

---

Jira Epic

↓

Internal Milestone Entity

---

Slack Thread

↓

Operational Signal

---

# 4. Operational Graph Engine

Core system.

---

Purpose

Represent relationships between:

* Customers
* Projects
* Milestones
* Tasks
* Owners
* Dependencies
* Revenue

---

Graph Example

```text
Customer
 ↓
Implementation
 ↓
Milestone
 ↓
Task
 ↓
Owner
```

---

Technology

**Implemented:** PostgreSQL adjacency tables (`project_task_dependencies`, graph builder service)

**Documented alternative (not in MVP):** Neo4j or PostgreSQL graph extension for very large dependency graphs

---

Reason

Allows:

* Dependency analysis
* Root cause analysis
* Impact analysis

---

# 5. Risk Engine

Purpose

Detect implementation risks.

---

Version 1

Rule-Based

---

Rules

Example:

Project inactive >10 days

↓

High Risk

---

Dependency overdue

↓

High Risk

---

Customer inactive >14 days

↓

Medium Risk

---

No assigned owner

↓

High Risk

---

Output

```json
{
  "risk_score": 85,
  "reason": "Customer dependency overdue"
}
```

---

# 6. Intelligence Engine

Purpose

Generate explanations.

---

Inputs

* Risk score
* Graph relationships
* Event history

---

Outputs

* Root cause
* Recommended action
* Impact assessment

---

Technology

LLM Layer

Candidates:

* GPT
* Claude
* Gemini

---

Prompt Pattern

Structured evidence only.

No hallucinations.

---

Example

Input:

```text
Project inactive 14 days
Security review pending
Customer not responding
```

Output:

```text
High likelihood of implementation delay due to unresolved security review.
```

---

# 7. API Layer

Architecture

REST First

GraphQL Later

---

Endpoints

### Projects

GET /projects

---

### Risks

GET /risks

---

### Insights

GET /insights

---

### Revenue Impact

GET /revenue-impact

---

# Database Design

## PostgreSQL

Core relational storage.

---

Tables

### Tenants

### Users

### Projects

### Customers

### Milestones

### Tasks

### Events

### Risks

### Recommendations

---

# Caching Layer

Technology

Redis

---

Usage

* Risk feed
* Dashboard queries
* Executive reports

---

# Multi-Tenancy

Approach

Tenant isolation.

---

Model

```text
Tenant
 ↓
Projects
 ↓
Users
```

---

Options

Row-level security.

---

Future

Dedicated enterprise deployments.

---

# Frontend Architecture

Technology

Next.js

React

TypeScript

---

UI Framework

shadcn/ui

TailwindCSS

---

Pages

### Executive Dashboard

### Project Detail

### Risk Feed

### Recommendations

### Integrations

### Settings

---

# Security Requirements

Authentication

Clerk

Auth0

---

Authorization

Role-based access.

---

Encryption

At Rest

AES-256

---

In Transit

TLS 1.3

---

Compliance

SOC2 Ready

GDPR Ready

---

# Observability

Monitoring

Datadog

OpenTelemetry

---

Metrics

API Latency

Event Throughput

Risk Processing Time

Integration Health

---

# AI Architecture

Version 1

Rule-based

---

Version 2

Predictive ML

---

Version 3

Generative Insights

---

Version 4

Prescriptive Intelligence

---

# Scalability Requirements

Year 1

100 Customers

---

Year 2

1,000 Customers

---

Year 3

10,000 Customers

---

Design Target

100M+ Events Per Month

---

# Technical Roadmap

Phase 1

Salesforce + Jira + Slack

Rule-based risk detection

---

Phase 2

Historical analysis

ML risk scoring

---

Phase 3

Cross-project intelligence

---

Phase 4

Operational intelligence platform

---

# Success Criteria

System can:

* Process events continuously
* Detect risks accurately
* Explain risks clearly
* Scale to enterprise customers

without requiring manual intervention.
