# UI Revamp 2026 — Architecture Decision Record

**Date:** 2026-04-21  
**Status:** Approved  
**Author:** Vladimir Cutkovic  

---

## Context

The current application operates as a strict linear wizard: users must traverse 10+ sequential steps to configure and deploy a pipeline. This creates significant friction for power users, makes reuse of connection credentials impossible, and forces re-entry of the same information across pipeline creations.

This document records all architectural decisions made for the major UX revamp targeting a more composable, multi-lane experience.

---

## Problem Statement

### Current limitations

1. **No reuse** — Kafka credentials, ClickHouse credentials, and schemas are re-entered for every new pipeline from scratch.
2. **Linear only** — Users cannot skip steps, fill sections out of order, or compose a pipeline from pre-configured pieces.
3. **No persistence outside pipeline configs** — The UI has no own storage layer; all state lives in-memory or in the Go backend as a pipeline blob.
4. **Single creation mode** — There is one path to pipeline creation. Power users and first-time users get the same experience.
5. **No observability home** — Pipeline health, DLQ status, and system alerts have no dedicated surface; they are buried in individual pipeline detail pages.

---

## Decision: Multi-Lane Architecture

The application will be restructured around **three creation lanes** plus a dedicated observability section. The existing wizard is preserved and enhanced rather than replaced.

### Lane 1 — Wizard (existing, enhanced)
The current linear step-by-step flow remains as the primary onboarding path for first-time users. It is the lowest-friction way to create a first pipeline.

**Enhancement:** At the Kafka connection and ClickHouse connection steps, users will be offered a "Save to Library" action so that wizard usage contributes to the shared component library.

### Lane 2 — Compose (new)
A two-layer power-user experience:

- **Library** — A global CRUD interface for managing reusable components: `KafkaConnection`, `ClickHouseConnection`, `Schema`, and schema-bound processing configs. Users manage these independently of any pipeline.
- **Canvas** — A visual flow builder (React Flow) where users drag saved library components onto a canvas, connect them, and assemble a complete pipeline without re-entering credentials.

### Lane 3 — AI (optional, existing + enhanced)
A conversational interface where users describe their pipeline intent in natural language. The AI lane is **feature-flagged** — it is hidden entirely when no AI API key is configured at installation time.

**Current state:** AI chat already produces a `PipelineIntentModel` and materialises it into the store.  
**Target state:** On conversation completion, AI pre-populates the Canvas (Lane 2) rather than deploying directly. The user gets visual confirmation before committing.  
**Future:** AI becomes an ambient assistant panel available across all lanes. AI can also offer to save discovered connections to the Library.

---

## Component Library

### What is a "component"

A component is a named, reusable piece of pipeline configuration that can be saved independently of any pipeline and referenced across multiple pipelines.

| Component type | Content | Can be reused across pipelines |
|---|---|---|
| `KafkaConnection` | Bootstrap servers, auth method, credentials | Yes |
| `ClickHouseConnection` | Host, port, username, credentials, SSL config | Yes |
| `Schema` | Named list of typed fields | Yes |
| `DeduplicationConfig` | Dedup key field, time window — bound to a Schema | Yes, for sources with matching schema |
| `FilterConfig` | Filter expression — bound to a Schema | Yes, for sources with matching schema |
| `TransformationConfig` | Computed fields — bound to a Schema | Yes, for sources with matching schema |

### Schema as a first-class entity

Schema is the **type system** that makes component reuse safe. A `DeduplicationConfig` that references field `user_id` is only valid when applied to a source whose schema contains that field.

**Schema sources:**
- Derived by consuming a sample event from a Kafka topic (existing flow)
- Imported from an external Schema Registry (existing branch, to be merged)
- Defined manually by the user

In all cases, once saved, a Schema has a name and independent identity — it is not permanently coupled to the source it was derived from.

### Library organisation

- **Folders** — User-defined groupings (e.g. "Production", "Staging", "Team A")
- **Tags** — Freeform labels for cross-cutting concerns (e.g. "kafka-prod", "clickhouse-analytics")
- **Search** — Full-text search across component names, tags, and descriptions
- **Sharing** — Org-wide. All users in an installation share one library. No per-user separation.

---

## Canvas Design

### Node model

The canvas uses **medium-grain nodes** — one node per logical pipeline stage. This maps 1:1 to how users already understand pipeline sections from the wizard.

**Single-topic pipeline:**
```
[KafkaSource] → [Dedup?] → [Filter?] → [Transform?] → [ClickHouseSink]
```

**Two-topic pipeline:**
```
[KafkaSource A] ↘
                 [Join] → [Filter?] → [Transform?] → [ClickHouseSink]
[KafkaSource B] ↗
```

**OTLP pipeline:**
```
[OTLPSource] → [Filter?] → [Transform?] → [ClickHouseSink]
```

### Optional nodes

Optional processing nodes (Dedup, Filter, Transform, Join) are **always rendered but greyed out**. Users click to activate them. This serves as inline documentation of the pipeline's capabilities and makes the execution order visually clear at all times.

### Library integration

A sidebar panel on the canvas surfaces saved Library components. Users drag a `KafkaConnection` from the sidebar onto the canvas to instantiate a `KafkaSource` node pre-filled with that connection's credentials. Schema selection and topic picker follow inline.

### Technology

React Flow (XY Flow) for the canvas renderer.

---

## Navigation Restructure

### New top-level navigation

```
Dashboard      ← default landing page
Pipelines      ← full pipeline list (accessible from Dashboard)
Library        ← component manager
Observability  ← dedicated per-pipeline health section
[Create]       ← modal surfacing lane selection
```

### Dashboard

The Dashboard replaces the current home page as the default landing view. It follows a **B+C hybrid** pattern:

- **Top band** — Aggregate health cards: total pipelines, healthy / degraded / error counts, DLQ message counts, total throughput (added progressively as observability data becomes available)
- **Alert feed** — Attention-required items: pipelines in error state, DLQ thresholds exceeded, recent incidents
- **Pipeline list** — Full list of pipelines with status and quick actions
- **Empty state** — First-time user onboarding guide that walks users toward saving their first Library component before creating their first pipeline

### Create modal

The "Create" action opens a modal (not a full page) presenting the available lanes:

```
┌─────────────────────────────────────────┐
│  Create a new pipeline                  │
│                                         │
│  ○ Wizard         Step-by-step guide    │
│  ○ Canvas         Compose from library  │
│  ○ AI Assistant   Describe your intent  │  ← hidden if AI not configured
└─────────────────────────────────────────┘
```

### Observability section

A dedicated top-level section for per-pipeline operational visibility. Built in parallel as a separate workstream.

**MVP scope (Phase 1):**
- Per-pipeline health status (mirrors existing `/health` API)
- DLQ state — message count, unconsumed count, consume action
- Notification channel configuration (mirrors existing `/notifications` API)

**Future scope:**
- Throughput graphs (events/sec, bytes/sec)
- Consumer lag metrics
- Structured log viewer
- Cross-pipeline aggregate dashboard (promoted to Dashboard top band)

---

## Persistence Layer

### Decision

The UI introduces its **own persistence layer**, separate from the Go backend's pipeline store. This layer owns Library component data: connections, schemas, processing configs, folder/tag metadata.

**This is not a proxy to the Go backend.** The Go backend owns pipeline execution configs. The UI layer owns reusable component definitions.

### Technology

| Concern | Choice | Rationale |
|---|---|---|
| Primary database | **Postgres** | Already a deployment dependency for the Go backend (`create postgres store for pipelines` in `glassflow-api/cmd/glassflow/main.go`). Operators configure one database; both services use it in separate schemas. |
| Fallback | **SQLite** | For minimal installs that don't run a full Postgres service. Drizzle supports both dialects with a one-line swap. |
| ORM | **Drizzle** | TypeScript-native, works with both Postgres and SQLite, lightweight, generates typed queries. |
| Schema isolation | **`ui_library` schema** | All UI-owned tables live under a dedicated Postgres schema to avoid conflicts with Go backend tables. |

### API surface

New Next.js API routes under `src/app/ui-api/library/`:

```
GET    /ui-api/library/connections/kafka
POST   /ui-api/library/connections/kafka
GET    /ui-api/library/connections/kafka/[id]
PUT    /ui-api/library/connections/kafka/[id]
DELETE /ui-api/library/connections/kafka/[id]

GET    /ui-api/library/connections/clickhouse
POST   /ui-api/library/connections/clickhouse
...

GET    /ui-api/library/schemas
POST   /ui-api/library/schemas
...

GET    /ui-api/library/folders
POST   /ui-api/library/folders
...
```

### Data model (initial)

```typescript
// KafkaConnection
{
  id: string (uuid)
  name: string
  description?: string
  folderId?: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  config: {
    bootstrapServers: string[]
    authMethod: string
    // credentials stored encrypted at rest
    ...
  }
}

// ClickHouseConnection
{
  id: string (uuid)
  name: string
  description?: string
  folderId?: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  config: {
    host: string
    httpPort: string
    nativePort?: string
    username: string
    // password stored encrypted at rest
    useSSL: boolean
    skipCertificateVerification: boolean
  }
}

// Schema
{
  id: string (uuid)
  name: string
  description?: string
  folderId?: string
  tags: string[]
  sourceType: 'kafka' | 'otlp' | 'manual'
  derivedFrom?: { connectionId: string, topic: string }
  createdAt: Date
  updatedAt: Date
  fields: Array<{ name: string, type: string }>
}

// Folder
{
  id: string (uuid)
  name: string
  parentId?: string  // for nested folders (future)
  createdAt: Date
}
```

---

## Build Sequence

### Phase 1 — Shell Restructure

**Goal:** Make the new architecture visible without building the hard parts.

- New top-level navigation (Dashboard, Pipelines, Library, Observability, Create)
- Dashboard page with pipeline list + aggregate health cards (initially static/placeholder)
- Empty state onboarding flow for new installations
- Create modal with lane selector (Wizard and Canvas options always shown; AI option shown only if `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set)
- Observability section — nav entry + placeholder page structure
- Library section — nav entry + empty state

**What does NOT change:** The wizard flow itself. It runs exactly as today, accessed via the Create modal.

### Phase 2 — Library

**Goal:** Users can save and manage reusable Kafka and ClickHouse connections.

- Drizzle + Postgres setup (`src/lib/db/`)
- Database migrations for `kafka_connections`, `clickhouse_connections`, `schemas`, `folders` tables
- API routes under `src/app/ui-api/library/`
- Library UI: connection list views, create/edit forms, folder tree, tag management, search
- "Test Connection" action on saved connections (reuses existing Kafka/ClickHouse service logic)
- Schema derivation: "Fetch from Kafka topic" action → saves as named Schema

### Phase 3 — Wizard → Library Bridge

**Goal:** Wizard users contribute to the shared library.

- On the Kafka Connection step: after a successful connection test, offer "Save this connection to Library" — a named input + save button, non-blocking (user can skip)
- On the ClickHouse Connection step: same pattern
- If a Library connection already exists for the detected broker/host, surface it as a "Use saved connection" shortcut at the top of the connection step

### Phase 4 — Canvas

**Goal:** Users can assemble pipelines visually from Library components.

- React Flow canvas with node definitions for KafkaSource, Dedup, Filter, Transform, Join, ClickHouseSink
- Library sidebar panel on canvas — searchable component picker
- Node configuration panels (click a node to configure it inline)
- Canvas → pipeline config serialisation (reuses existing `generateApiConfig()` and adapter pattern)
- Canvas → deploy flow (reuses existing pipeline creation API route)
- AI lane integration: AI chat completion pre-populates canvas nodes

### Phase 5 — Observability

**Goal:** Users can diagnose pipeline health from a dedicated section.

- Per-pipeline health dashboard (status, uptime, error rate)
- DLQ viewer with consume action
- Notification channel configuration
- (Future) Throughput graphs, log viewer, cross-pipeline aggregate view on Dashboard

---

## Decisions Not Yet Made

The following questions are deferred and should be revisited during Phase 4:

1. **Canvas persistence** — Should in-progress canvas assemblies be saveable as "drafts" before deployment? If so, drafts live in the UI persistence layer.
2. **Schema-bound config reuse UI** — How does the user discover that a saved `DeduplicationConfig` is compatible with their current schema? What is the matching/suggestion UX?
3. **Credential encryption** — Library connections store credentials. What encryption strategy is used at rest? Environment-variable-based key? Operator-provided secret?
4. **AI → Library promotion** — When AI identifies a Kafka connection during chat, should it offer to save it to the Library before populating the canvas?
5. **Canvas layout persistence** — Should node positions on the canvas be saved per-pipeline, or recalculated on each open?

---

## Constraints & Non-Goals

- **Self-hosted only** — GlassFlow is not SaaS. There is no cloud-hosted API key for AI. The AI lane must be fully optional and gracefully hidden.
- **No per-user data** — All Library components are org-wide. Per-user preferences or private components are out of scope.
- **Wizard is not being removed** — It remains a supported, first-class lane indefinitely.
- **No breaking changes to pipeline config format** — The compose lane produces the same pipeline config blob that the wizard produces. The Go backend is unaffected.
- **Dark theme only** — The app is dark-theme only (`ThemeProvider defaultTheme="dark"`, `enableSystem=false`). No light-theme work.
