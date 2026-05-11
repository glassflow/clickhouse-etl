---
type: glossary
product: GlassFlow ClickHouse ETL
created: 2026-05-11
updated: 2026-05-11
skill: product:model
---

# Glossary — GlassFlow ClickHouse ETL

Every term used in the UI, documentation, and codebase should match this glossary. When adding a new concept, check here first. When a term appears with multiple names, the primary term below is the canonical one.

---

## Pipeline

**Definition:** An end-to-end data flow that reads events from a source (Kafka topic or OTLP endpoint), applies optional processing steps (deduplication, filtering, transformation), and writes to a ClickHouse table. A Pipeline is the central entity in the product — everything else either configures or monitors a Pipeline.

**Use in UI:** "Create pipeline", "Pipeline details", "Pipeline status", "Delete pipeline"

**Do not use:** "Job", "flow", "task", "data flow" (except in marketing copy)

**Technical equivalent:** Pipeline config blob in Go backend; `Pipeline` type in `src/types/pipeline.ts`

---

## Connection

**Definition:** A saved, reusable set of credentials and configuration for connecting to either a Kafka cluster or a ClickHouse instance. Connections are stored in the Library and can be referenced by multiple Pipelines.

**Use in UI:** "Kafka connection", "ClickHouse connection", "Add connection", "Test connection"

**Do not use:** "Credential", "config", "integration"

**Technical equivalent:** `KafkaConnection`, `ClickHouseConnection` in Drizzle schema; `connections` table in `ui_library` DB

---

## Schema

**Definition:** A named, typed list of fields that describes the shape of event data flowing through a Pipeline. Schema is the type system that makes component reuse safe — a Transform or Filter is only valid when applied to a source whose Schema matches. Schemas can be derived from a live Kafka topic, imported from a Schema Registry, or defined manually.

**Use in UI:** "Schema", "Event schema", "Derive schema from topic", "Schema version"

**Do not use:** "Event type", "data model", "message format", "struct"

**Technical equivalent:** `Schema` in `src/types/schema.ts`; `schemas` table in `ui_library` DB

---

## Transform

**Definition:** A reusable definition of computed field operations — renaming fields, computing derived values, changing types — bound to a specific Schema. A Transform can be saved to the Library and reused across Pipelines that share the same Schema.

**Use in UI:** "Transform", "Transformation" (as a section heading only), "Add transform", "Transform config"

**Do not use:** "Transformation config" (in routes/code — use "transform"), "function", "mapper", "processor"

**Technical equivalent:** `TransformationConfig` in store; `transforms` table in `ui_library` DB; step key `transformation-configurator` in wizard

> **Note on naming:** The UI may use "Transformation" as a section heading (e.g., "Transformation step") because it reads more naturally as a noun phrase. In routes, code, and Library tabs, use "transform".

---

## Filter

**Definition:** A reusable conditional expression that determines which events from a source pass through to ClickHouse. A Filter is bound to a Schema and can be saved to the Library for reuse across Pipelines with the same Schema.

**Use in UI:** "Filter", "Add filter", "Filter expression", "Filter config"

**Do not use:** "Rule", "condition", "predicate", "where clause"

**Technical equivalent:** `FilterConfig` in store; `filter_configs` table in `ui_library` DB; step key `filter-configurator` in wizard

---

## Deduplication

**Definition:** A processing step that removes duplicate events from a stream based on a key field and a time window. A DeduplicationConfig specifies the key field and window, is bound to a Schema, and can be saved to the Library.

**Use in UI:** "Deduplication", "Dedup key", "Dedup window", "Deduplication config"

**Do not use:** "Dedup" (acceptable as abbreviation in tables/badges), "dedup rule", "uniqueness constraint"

**Technical equivalent:** `DeduplicationConfig` in store; `dedup_configs` table in `ui_library` DB; step key `deduplication-configurator` in wizard

---

## Library

**Definition:** The shared repository of reusable Pipeline components — Connections, Schemas, Transforms, Filters, and Deduplication configs. The Library is org-wide: all users in an installation share one Library. Items in the Library can be referenced by multiple Pipelines.

**Use in UI:** "Library", "Save to Library", "Pick from Library"

**Do not use:** "Component library" (internal term), "catalog", "registry" (reserved for Schema Registry), "saved configs"

**Technical equivalent:** `ui_library` Postgres schema; all `src/app/ui-api/library/*` routes

---

## Draft

**Definition:** An in-progress pipeline configuration that has been started but not yet deployed. A Draft persists across sessions so that work is never lost. Drafts appear in the Pipelines list with a "Draft" status badge. A Draft becomes a Pipeline when deployed, or is discarded.

**Use in UI:** "Draft", "Continue draft", "Discard draft", "Resume draft"

**Do not use:** "In progress", "unsaved", "pending pipeline"

**Technical equivalent:** Not yet fully implemented — the wizard does not persist drafts today (known gap). Canvas also loses state on navigate-away. Draft persistence is a required near-term feature.

---

## Canvas

**Definition:** The visual pipeline builder — a node-based interface where users drag Library components onto a canvas, connect them in sequence, and configure each node inline. Canvas is a **creation mode**, not a top-level navigation destination. It is accessed via the Create modal. A separate per-pipeline canvas is available for editing an existing deployed Pipeline's configuration.

**Use in UI:** "Open in Canvas", "Pipeline Canvas", "Canvas editor"

**Do not use:** "Flow editor", "diagram", "visual builder" (acceptable in onboarding copy)

**Technical equivalent:** `CanvasView` component; React Flow (XY Flow); `/canvas` route (creation) and `/pipelines/[id]/canvas` route (editing)

> **Disambiguation:** Two canvas contexts exist today. The **creation canvas** (`/canvas`) assembles a new pipeline Draft. The **editing canvas** (`/pipelines/[id]/canvas`) modifies an existing deployed Pipeline. They share the `CanvasView` component but serve different purposes and should be labeled differently in the UI.

---

## Revision

**Definition:** A saved snapshot of a Pipeline's configuration at a point in time. Revisions are created automatically when a Pipeline's config is updated. A user can view revision history and (in future) roll back to a previous Revision.

**Use in UI:** "Revision", "Revision history", "Configuration revision"

**Do not use:** "Version" (reserved for Library artifact versioning), "snapshot", "backup"

**Technical equivalent:** `PipelineRevision` in Drizzle; `/ui-api/pipelines/[id]/revisions` routes

---

## Observability

**Definition:** The product area dedicated to understanding what is happening inside running Pipelines — health status, DLQ state, throughput metrics, and structured logs. Observability is a **top-level product area** in the navigation. Do not use "observability" to describe stack admin, system settings, or generic monitoring.

**Use in UI:** "Observability", "Pipeline observability", "View in Observability"

**Do not use:** "Monitoring" (generic; use observability), "telemetry" (internal engineering term)

**Technical equivalent:** `/observability` route group; VictoriaMetrics (metrics) + VictoriaLogs (logs) as data sources; `/workspace/observability` (stack admin — this is NOT observability, see below)

---

## Health

**Definition:** The runtime status of a specific Pipeline at a point in time — whether it is actively processing, paused, in error, and what the DLQ state looks like. Health is a component of the per-pipeline Observability view, not the same as system-wide Observability.

**Use in UI:** "Pipeline health", "Health status", "Healthy / Degraded / Error"

**Do not use:** "Status" (status = the pipeline state; health = the qualitative assessment of that state)

**Technical equivalent:** `PipelineHealth` type; `/ui-api/pipeline/[id]/health` API route

---

## Environment

**Definition:** A lightweight user-defined label applied to Pipelines to indicate logical groupings such as staging, production, or development. Environments are not structural — they do not create separate namespaces, access controls, or configurations. They are filtering and organizational tools only.

**Use in UI:** "Environment", environment label pills on pipeline cards, filter in Pipelines list

**Do not use:** "Namespace", "workspace", "project", "tenant"

---

## Source

**Definition:** The origin of event data for a Pipeline. Currently supported: Kafka (topic-based) and OTLP (OpenTelemetry Protocol). Source type is selected at Pipeline creation and determines which configuration steps are shown.

**Use in UI:** "Source", "Kafka source", "OTLP source", "Source type"

**Do not use:** "Input", "origin", "producer"

---

## Destination

**Definition:** The target system where processed events are written. Currently always ClickHouse. Destination configuration covers the ClickHouse connection, target database and table, and schema mapping between source fields and destination columns.

**Use in UI:** "Destination", "ClickHouse destination", "Destination table"

**Do not use:** "Output", "sink", "target" (acceptable in technical docs)

---

*Updated 2026-05-11 via product:model*
