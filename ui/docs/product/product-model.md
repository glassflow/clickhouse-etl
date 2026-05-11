---
type: product-model
product: GlassFlow ClickHouse ETL
tier: pro
status: complete
created: 2026-05-11
updated: 2026-05-11
skill: product:model
---

# Product Model — GlassFlow ClickHouse ETL

## Product Promise

A self-hosted control plane that gives data teams a unified surface to configure, deploy, and monitor Kafka or OTLP → ClickHouse pipelines — covering the full lifecycle from first configuration to production operations, without needing external tooling.

## Primary Users

| User | Technical level | Primary goal | Secondary goal |
|------|----------------|-------------|----------------|
| **Data Engineer** (primary) | High | Configure and deploy complex pipelines; build reusable Library components | Monitor health, investigate incidents |
| **Platform/DevOps Engineer** (primary) | High | Deploy and operate pipelines; observe system health | Manage notifications, DLQ, resources |
| **Data Analyst** (secondary/aspirational) | Medium-low | Create pipelines via guided wizard or AI assistant | Monitor dashboards, react to alerts |

The product must work end-to-end for the primary users without compromise, and be approachable enough that secondary users can succeed at core tasks with in-product guidance.

---

## Core Objects

| Object | Description | Owned by | Authority |
|--------|-------------|----------|-----------|
| **Pipeline** | An end-to-end data flow from a source to ClickHouse — the central entity | Go backend | Go backend |
| **Connection** | A saved, reusable set of credentials and config for Kafka or ClickHouse | UI (Drizzle/Postgres) | UI persistence layer |
| **Schema** | A named, typed field list that describes the shape of event data — the type anchor for reuse | UI (Drizzle/Postgres) | UI persistence layer |
| **Transform** | A reusable set of computed field definitions, bound to a Schema | UI (Drizzle/Postgres) | UI persistence layer |
| **Filter** | A reusable filter expression, bound to a Schema | UI (Drizzle/Postgres) | UI persistence layer |
| **DeduplicationConfig** | A reuse key + time window for deduplication, bound to a Schema | UI (Drizzle/Postgres) | UI persistence layer |
| **Draft** | An in-progress pipeline configuration that has not been deployed | UI (Drizzle/Postgres) | UI persistence layer |
| **PipelineRevision** | A historical snapshot of a pipeline's configuration | UI (Drizzle/Postgres) | UI persistence layer |
| **LibraryReference** | A pinned link between a Pipeline and a specific version of a Library artifact | UI (Drizzle/Postgres) | UI persistence layer |
| **PipelineHealth** | Runtime status, error state, and DLQ snapshot for a running pipeline | Go backend | Go backend |
| **NotificationChannel** | An alert endpoint configuration (webhook, email, etc.) | Notification service | Notification service |

> **Schema is the type system.** Transform, Filter, and DeduplicationConfig are only meaningful when applied to a source with a matching Schema. Schema derivation (from Kafka event sampling), import (from Schema Registry), and manual definition are all equally valid ways to produce a Schema.

---

## Object Relationships

```
Pipeline
  ├── references KafkaConnection or OTLP (source)
  ├── references ClickHouseConnection (destination)
  ├── references Schema (describes event shape)
  ├── optionally references DeduplicationConfig (bound to same Schema)
  ├── optionally references Filter (bound to same Schema)
  ├── optionally references Transform (bound to same Schema)
  ├── has many PipelineRevisions (history)
  ├── has many LibraryReferences (artifacts pinned at a version)
  └── has one PipelineHealth (runtime state, owned by backend)

Draft
  └── becomes a Pipeline on deploy (or is discarded)

Library (shared component pool)
  ├── Connection (KafkaConnection | ClickHouseConnection)
  ├── Schema
  │     ├── Transform (bound to this Schema)
  │     ├── Filter (bound to this Schema)
  │     └── DeduplicationConfig (bound to this Schema)
  └── Folder (organizational grouping, not yet wired to UI)

Notification
  └── NotificationChannel (per-pipeline, owned by notification service)
```

---

## Object Lifecycle States

### Pipeline

| State | Meaning | Triggered by |
|-------|---------|--------------|
| `starting` | Being deployed — containers launching | User clicks Deploy |
| `active` | Running and processing events | Backend confirms healthy |
| `pausing` | Pause requested, not yet confirmed | User clicks Pause |
| `paused` | Processing suspended; no data loss | Backend confirms paused |
| `resuming` | Resume requested, not yet confirmed | User clicks Resume |
| `stopping` | Stop requested — graceful shutdown | User clicks Stop |
| `stopped` | Halted permanently; requires redeploy to restart | Backend confirms stopped |
| `terminating` | Deletion in progress | User confirms Delete |
| `failed` | Runtime error — pipeline halted unexpectedly | Backend reports error |

> **Known issue (out of scope for this round):** Transition state logic can briefly show illogical intermediate states (e.g., `active` immediately after a stop request). Flagged for a dedicated state-machine audit.

### Draft

| State | Meaning | Triggered by |
|-------|---------|--------------|
| `in_progress` | User is actively assembling config (wizard, canvas, or AI) | User starts creation |
| `deployed` | Config submitted and accepted by backend → becomes a Pipeline | User clicks Deploy |
| `discarded` | User explicitly discards or overrides | User discards |

> **Current implementation gap:** The wizard does not currently persist a draft — navigating away loses all work silently. Canvas also has no draft save. Draft persistence is a required feature before the next major release.

### Library Artifact (Connection, Schema, Transform, Filter, DeduplicationConfig)

| State | Meaning | Triggered by |
|-------|---------|--------------|
| `active` | Available for use; can be referenced by Pipelines | Created by user |
| `archived` | No longer shown in search; existing references preserved | User archives (future) |

> Schemas and Transforms use versioning rather than in-place mutation. A new version is created; the previous version remains pinned by existing Pipelines.

---

## User Roles

| Role | Can do | Cannot do (currently) |
|------|--------|-----------------------|
| **All authenticated users** | Create/edit/delete pipelines; full Library CRUD; view metrics and logs; manage notification settings | — |
| **Unauthenticated (auth disabled)** | Everything above (auth is optional, off by default) | — |
| **Future: Admin** | Stack config, user management | — (not built) |

> The product has no per-user data separation today. All users in an installation share one Library. Environment labels (staging/production/dev) on Pipelines are the lightweight equivalent of workspace separation.

---

## Product Areas

| Area | User question answered | Primary objects | Entry point |
|------|----------------------|-----------------|-------------|
| **Dashboard** | "What is the state of my system right now?" | PipelineHealth, Pipeline (summary) | Default landing page |
| **Pipelines** | "What pipelines do I have and how are they doing?" | Pipeline, Draft, PipelineRevision, PipelineHealth | Sidebar nav |
| **Library** | "What reusable components have I saved?" | Connection, Schema, Transform, Filter, DeduplicationConfig | Sidebar nav |
| **Observability** | "What's happening inside a specific pipeline or my system?" | PipelineHealth, metrics, logs | Sidebar nav |
| **[Create]** | "How do I start a new pipeline?" | Draft | Sidebar Create button → modal |

---

## Positioning

**Category:** Control plane for data pipelines  
**Primary user:** A data engineer or platform engineer who manages Kafka/OTLP → ClickHouse data flows in a self-hosted environment  
**Main pain:** No unified surface — teams juggle API calls, CLI tools, Grafana, and custom scripts to configure, deploy, and monitor pipelines; the lifecycle is fragmented across tools  
**Main promise:** One UI that covers the full pipeline lifecycle — from first configuration to production operations — without needing to reach for external tooling  
**Main alternative:** Direct API (Postman/curl) for management + Grafana for metrics + CLI for operations  
**Differentiation:** Purpose-built unification of the entire pipeline lifecycle in one opinionated, ClickHouse-native UI — not a generic ETL tool, not a general dashboard, but a control plane that understands the specific topology it manages

---

## Non-Goals

- This product will not become a general-purpose ETL platform with arbitrary destination support (ClickHouse is the only destination for the foreseeable future).
- This product will not become a data transformation IDE or a place where users write and test complex SQL/code pipelines.
- This product will not be offered as SaaS or support multi-tenancy.
- This product will not replace general-purpose observability tools (Grafana, Datadog). Observability in this product is targeted and opinionated, not a general metrics platform.
- This product will not implement first-class environment management. Environments are lightweight pipeline labels and list filters — not a structural concept with separate namespaces, access control, or configurations.

---

## Opportunities

**Desired outcome:** A data engineer successfully deploys their first pipeline and returns to the Dashboard with confidence that they can monitor and control it from here.

| Opportunity | Evidence | Solutions considered | Chosen approach |
|-------------|----------|---------------------|-----------------|
| Pre-deployment complexity blocks non-expert users | Wizard steps lack guidance; no contextual help per field | (A) Wizard tooltips + help text, (B) AI-first flow, (C) Template library | All three — layered by experience level |
| Post-deployment experience is thin | `/observability` is a stub; metrics/logs/health are in separate tabs with no unifying view | (A) Full observability section, (B) Dashboard as health home, (C) Per-pipeline overview card | (A) + (B) — both are required |
| Reuse is manual and error-prone | No Library before revamp; credentials re-entered per pipeline | (A) Library CRUD, (B) Wizard → Library bridge, (C) Canvas from Library | (A) + (B) + (C) — full Library path |
| Terminology drift prevents consistency | "Transform" vs "Transformation", "Canvas" dual meaning, "Workspace" undefined | (A) Glossary doc, (B) UI label audit, (C) Codebase rename | (A) first, then (B) — codebase rename is lower priority |

---

*Updated 2026-05-11 via product:model*
