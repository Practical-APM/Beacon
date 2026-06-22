# Beacon

# Product Requirements Document (PRD)

Version: 1.0

Owner: Product Team

Status: MVP Definition

---

# Product Overview

Beacon is a proactive implementation risk intelligence platform.

The platform continuously analyzes operational signals across customer implementations and identifies:

* Delayed projects
* Risk factors
* Revenue impact
* Recommended actions

The objective is to help leadership teams prevent implementation failures before they occur.

---

# MVP Goal

Answer one question exceptionally well:

> Which customer implementations are likely to miss their target go-live date, and why?

If we solve this reliably, customers will pay.

Everything else is secondary.

---

# Users

## Executive User

Examples:

* COO
* CRO
* CEO
* VP Customer Success

Needs:

* Portfolio visibility
* Revenue risk visibility
* Escalation visibility

---

## Operational User

Examples:

* Head of Implementation
* Professional Services Director
* Customer Success Manager

Needs:

* Project health visibility
* Blocker visibility
* Recommended actions

---

## Individual Contributor

Examples:

* Implementation Manager
* Solutions Engineer

Needs:

* Project-level risk insights
* Ownership visibility

---

# MVP Scope

## Included

### Risk Detection

Identify:

* Delayed projects
* At-risk projects
* Stalled projects

---

### Root Cause Detection

Identify:

* Customer dependency delays
* Internal dependency delays
* Missing ownership
* Resource constraints
* Communication gaps

---

### Revenue Impact

Estimate:

* ARR impacted
* ARR delayed
* ARR at risk

---

### Action Recommendations

Generate:

* Recommended owner
* Suggested action
* Escalation recommendations

---

## Excluded

Not in MVP:

* Churn prediction
* Revenue forecasting
* AI agents
* Workflow automation
* Resource planning
* Capacity forecasting

---

# Integrations

## Phase 1 Integrations

### Salesforce

Data:

* Opportunities
* Customers
* ARR
* Target go-live date
* Customer owner

---

### Jira

Data:

* Tasks
* Status
* Sprint activity
* Dependencies

---

### Slack

Data:

* Channel activity
* Stakeholder engagement
* Escalations

---

# Core Product Architecture

## Layer 1

Operational Data Collection

Sources:

Salesforce

Jira

Slack

---

## Layer 2

Implementation Graph

Creates relationships:

Customer

↓

Project

↓

Tasks

↓

Owners

↓

Dependencies

---

## Layer 3

Risk Engine

Analyzes:

* Progress velocity
* Stakeholder responsiveness
* Dependency completion
* Milestone health

---

## Layer 4

Intelligence Layer

Generates:

* Risk scores
* Root causes
* Recommendations

---

# User Journey

## First Login

User:

Connects:

* Salesforce
* Jira
* Slack

---

System:

Imports implementation data.

Creates implementation graph.

Calculates initial risk scores.

---

## Daily Workflow

User logs in.

Sees:

### Portfolio Summary

Active Implementations:

25

At Risk:

7

Blocked:

3

Delayed Revenue:

$280,000

---

User clicks project.

Sees:

Risk Score

Root Cause

Predicted Delay

Suggested Action

---

# Dashboard Requirements

## Executive Dashboard

Metrics:

### Active Implementations

### At Risk Implementations

### Delayed Revenue

### Average Time To Go Live

### Risk Trend

---

# Risk Feed

Similar to Datadog incidents.

Example:

Implementation:

Acme Corp

Risk:

High

Reason:

Customer security review inactive for 18 days

Potential Delay:

14 days

Revenue Impact:

$45,000 ARR

Suggested Action:

Escalate to customer champion

---

# Project Detail Page

Sections:

## Overview

Customer

Owner

Go-Live Date

ARR

---

## Health Summary

Risk Score

Trend

Confidence

---

## Detected Risks

List of identified issues

---

## Recommended Actions

Action list

---

## Activity Timeline

Unified operational timeline

Pulled from:

Salesforce

Jira

Slack

---

# Risk Scoring Framework

## Initial Version

Rule-Based

Examples:

### High Risk

No project activity for 10 days

---

### High Risk

Critical dependency overdue

---

### Medium Risk

Customer response delay

---

### Medium Risk

Milestone completion behind schedule

---

# Future Version

Machine Learning

Inputs:

Historical projects

Success patterns

Failure patterns

Outputs:

Predicted implementation outcomes

---

# Notification System

Daily Digest

Example:

3 projects entered high-risk state.

Estimated ARR impact:

$120,000

---

Immediate Alerts

When:

Risk score crosses threshold.

---

# Success Metrics

## Product Metrics

Risk Detection Accuracy

Target:

80%

---

Weekly Active Usage

Target:

70%

---

Executive Retention

Target:

85%

---

# Non-Functional Requirements

Response Time:

< 2 seconds

---

Dashboard Load:

< 3 seconds

---

Availability:

99.9%

---

Security:

SOC2-ready architecture

---

# MVP Exit Criteria

We will consider MVP successful if:

* 10 customers actively use the platform
* Risk predictions are trusted
* Customers report reduced implementation delays
* Renewal intent exceeds 80%

---

# Future Roadmap

V2

Customer Success Intelligence

---

V3

Revenue Intelligence

---

V4

Operational Intelligence Platform

---

V5

Business Operating System
