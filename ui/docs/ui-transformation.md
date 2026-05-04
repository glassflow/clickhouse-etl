# GlassFlow ClickHouse ETL — System Capabilities & UI Improvement Roadmap

## Current state summary

The system is a production-grade stream processing engine (Kafka → NATS → ClickHouse) with a Go backend, Next.js UI, and microservice architecture (ingestor, processor, dedup, join, filter, sink). The backend has significantly more capability than the UI currently exposes — this is your biggest opportunity.

---

## A. What the backend already provides (UI just needs to consume it)

These improvements require **no backend changes** — the data is already available via existing API endpoints or OpenTelemetry metrics.

### 1. Pipeline error details & diagnostics

**Current gap:** When a pipeline fails, the UI shows a red “Failed” badge — nothing more. The user has no idea why it failed.

**Available now:**

- The API returns structured error details with `current_status`, `requested_status`, `valid_transitions`, and error messages on state transition failures
- Component failure signals are published to NATS (`component-signals.failures`) with PipelineID, Component, Reason, Text
- The `pipeline_history` table stores audit events with type history/error/status as JSONB
- DLQ messages contain the specific component that failed, the error message, and the `original_message` payload

**Improvements:**

- Error detail panel on the pipeline details page showing the failure reason, affected component, and timestamp
- Component-level health breakdown — show which component (ingestor/sink/dedup/join/filter) is healthy vs failing
- DLQ event browser — the `getDLQEvents()` API function already exists in the UI code but there’s no UI to browse individual failed events, inspect their payloads, understand the error, and potentially retry or dismiss them
- State transition timeline — visualize the pipeline’s state history (Created → Running → Failed) with timestamps from `pipeline_history`

### 2. Dead Letter Queue deep inspection

**Current gap:** UI shows only a count of unconsumed DLQ messages. No way to inspect what failed or why.

**Available now:**

- `GET /api/v1/pipeline/{id}/dlq/consume` returns up to 1000 messages with component, error, and `original_message`
- `GET /api/v1/pipeline/{id}/dlq/state` returns total/unconsumed counts plus last received/consumed timestamps

**Improvements:**

- DLQ message viewer — paginated table showing failed messages with component, error type, error message, and expandable original payload
- Error categorization dashboard — group DLQ messages by error type and component to identify patterns (e.g., “85% of failures are schema validation errors in the ingestor”)
- DLQ trend indicator — show whether DLQ accumulation rate is increasing/decreasing/stable
- Selective DLQ operations — currently only “purge all” exists; could add filtering/selective acknowledgment

### 3. ClickHouse destination metrics (richer display)

**Current gap:** The UI has a ClickHouse metrics card with some data, but it’s basic and not time-series.

**Available now:**

- Backend tracks `gfm_clickhouse_records_written_total`, `gfm_clickhouse_records_written_per_second`, `gfm_bytes_processed_total` via OTEL
- The sink records `RecordProcessingDurationWithStage()` for stages: `schema_mapping`, `total_preparation`, `per_message`
- ClickHouse system tables (`system.parts`, `system.query_log`, `system.metrics`) can be queried directly

**Improvements:**

- Throughput sparkline/chart — show records/sec and bytes/sec over time (even a simple rolling 5-minute chart)
- Batch performance breakdown — show average batch size, batch frequency, and flush triggers (size-based vs time-based)
- Sink stage latency — show where time is spent: schema mapping vs preparation vs insert
- Table growth metrics — row count delta, disk usage trending

### 4. Pipeline resource visibility

**Current gap:** Resources (CPU/memory/replicas) are configurable but there’s no runtime utilization view.

**Available now:**

- `GET /api/v1/pipeline/{id}/resources` returns allocated resources
- `GET /api/v1/pipeline/{id}/resources/validation` returns immutability constraints
- Resource structure includes ingestor, join, sink with replicas/CPU/memory/storage

**Improvements:**

- Resource allocation overview — visual representation of what’s allocated per component
- Immutable fields indicator — clearly mark which fields can’t be changed after creation
- Resource recommendation hints — based on throughput metrics, suggest whether resources are over/under-provisioned

### 5. OpenAPI / Swagger integration

**Available now:** The API serves OpenAPI spec at `/api/v1/openapi.json` and Swagger UI at `/api/v1/docs`.

**Improvement:** Expose a link or embedded API explorer in the UI for advanced users.

---

## B. Improvements requiring minor backend additions

These need small new endpoints or modifications to existing ones, but the underlying data/infrastructure already exists.

### 1. Pipeline event / audit timeline

**Current state:** `pipeline_history` table exists with event types (history/error/status) but no dedicated API endpoint to query it.

**Backend work needed:** New `GET /api/v1/pipeline/{id}/history` endpoint

**UI improvement:**

- Activity timeline — chronological feed of pipeline events: created, started, config changed, error occurred, stopped, resumed
- Status transition visualization — state machine diagram with the current state highlighted and valid transitions shown
- Error event details — expandable entries showing what went wrong at each error point

### 2. Component-level health breakdown

**Current state:** Only an `overall_status` field in the health response. Component signals exist on NATS but aren’t exposed via REST.

**Backend work needed:** Extend `GET /api/v1/pipeline/{id}/health` to include per-component status (ingestor, processor, sink, dedup, join, filter)

**UI improvement:**

- Component health dashboard — show each pipeline component as a card/node with its own status indicator
- Data flow visualization — animated diagram: Kafka → Ingestor → [Dedup] → [Filter] → [Transform] → Sink → ClickHouse with health status on each node
- Component-level error counts — DLQ messages already have component field; aggregate and display per component

### 3. Kafka consumer lag & topic metrics

**Current state:** The Kafka consumer uses franz-go with manual offset management. Consumer group info is available but not exposed via API.

**Backend work needed:** New endpoint to expose Kafka consumer group lag (offset position vs log end offset per partition)

**UI improvement:**

- Consumer lag gauge — show how far behind the consumer is from the latest messages
- Per-partition view — show partition assignment and progress for each partition
- Throughput metrics — messages consumed/sec from the `gfm_kafka_records_read_total` counter
- Backpressure indicators — show when NATS publish throttling is active (async pending limit reached)

### 4. NATS internal queue metrics

**Current state:** NATS JetStream is the internal message bus. Stream info (message count, bytes, consumer info) is accessible via NATS client APIs but not exposed via REST.

**Backend work needed:** New endpoint to expose NATS stream stats (message count, bytes, pending, ack pending)

**UI improvement:**

- Internal queue depth — show how many messages are buffered between ingestor and sink
- Processing pipeline visualization — show message flow rates between components
- Backlog indicator — alert when internal queue is growing (sink can’t keep up)

### 5. Pipeline metrics API (time-series)

**Current state:** OTEL metrics are collected and exported to an external telemetry system. No built-in metrics query API.

**Backend work needed:** Either:

- (a) New endpoint that queries the OTEL backend (Prometheus/etc.) for pipeline-specific metrics, or
- (b) A lightweight in-memory metrics buffer in the API that stores recent metrics (last hour)

**UI improvement:**

- Metrics dashboard with time-series charts for:
  - Records ingested/sec (from Kafka)
  - Records written/sec (to ClickHouse)
  - Processing latency (P50, P95, P99)
  - DLQ rate (failures/sec)
  - Bytes processed
- Anomaly detection — highlight when metrics deviate significantly from baseline

### 6. Pipeline configuration diff / versioning

**Current state:** Edit operations store the new config, but there’s no version history.

**Backend work needed:** Store config snapshots on each edit in `pipeline_history` or a new `pipeline_versions` table.

**UI improvement:**

- Config version history — list of saved configurations with timestamps
- Diff view — side-by-side comparison of config changes between versions
- Rollback capability — one-click revert to a previous configuration

---

## C. Improvements requiring significant backend work

These need new subsystems or substantial API additions.

### 1. Real-time log streaming

**Current state:** Structured logging exists throughout the backend (slog), but logs go to stdout/file. The UI has a basic log viewer that polls an endpoint.

**Backend work needed:**

- Log aggregation from all pipeline components (ingestor, processor, sink)
- WebSocket or SSE endpoint for real-time log streaming
- Log filtering by component, severity, pipeline ID

**UI improvement:**

- Live log viewer — real-time log stream with auto-scroll, component color coding, severity filtering
- Log search — full-text search across pipeline logs
- Error log highlighting — automatic jump to error entries
- Log level filtering — toggle debug/info/warn/error visibility

### 2. Alert & notification rules engine

**Current state:** Notification settings pages exist in the UI (`/notifications/settings`), but the alerting capability is minimal.

**Backend work needed:**

- Alert rule engine (conditions like “DLQ count > 100”, “throughput < X/sec”, “pipeline failed”)
- Notification channels (email, Slack webhook, PagerDuty)
- Alert state management (firing, resolved, silenced)

**UI improvement:**

- Alert rules editor — create conditions on any metric or state
- Alert history — log of all triggered and resolved alerts
- Notification channel management — configure where alerts get sent
- Alert dashboard — current firing alerts across all pipelines

### 3. Pipeline dependency & topology view

**Backend work needed:** Track relationships between pipelines (shared Kafka topics, shared ClickHouse tables)

**UI improvement:**

- Topology map — visual graph showing all pipelines and their connections to Kafka topics and ClickHouse tables
- Impact analysis — “if I stop this pipeline, what’s affected?”
- Shared resource warnings — highlight when multiple pipelines write to the same table

### 4. Schema evolution management UI

**Current state:** Schema versioning exists (`schema_versions` table) with compatibility checks. External schema registry support is implemented.

**Backend work needed:** Minor — mostly surfacing existing data

**UI improvement:**

- Schema version browser — list all versions of a pipeline’s schema with diffs
- Compatibility status — show whether a new schema version is compatible
- Schema registry integration panel — show external registry status, available schemas
- Field mapping visualizer — interactive view of source field → ClickHouse column mapping with type indicators

### 5. Bulk operations & pipeline groups

**Backend work needed:** Batch API endpoints for multi-pipeline operations

**UI improvement:**

- Multi-select actions — stop/resume/delete multiple pipelines at once
- Pipeline groups/folders — organize pipelines by project/team/environment
- Bulk status overview — dashboard showing aggregate health across pipeline groups

### 6. Pipeline cloning & templates

**Backend work needed:** Clone endpoint that duplicates a pipeline config with a new ID/name

**UI improvement:**

- Clone pipeline — one-click duplicate of an existing pipeline config
- Template library — save pipeline configs as reusable templates
- Quick create from template — bypass the wizard for common patterns

### 7. Data preview & sampling

**Backend work needed:** Endpoint to sample recent messages from the pipeline data flow at any stage

**UI improvement:**

- Live data preview — see actual messages flowing through each pipeline stage
- Before/after transformation view — show the input message and the transformed output side-by-side
- Schema validation preview — show what would pass/fail validation with sample data

### 8. Performance profiling & bottleneck detection

**Backend work needed:** Expose per-component timing and queue depth metrics as a unified profiling endpoint

**UI improvement:**

- Pipeline profiling view — flame chart or waterfall showing where time is spent in the processing chain
- Bottleneck detection — automatically identify the slowest component
- Capacity planning — based on current throughput, estimate when resources will be saturated

---

## D. Quick wins (implementable in 1–2 days each)

| # | Improvement | Backend change | Effort |
|---|-------------|----------------|--------|
| 1 | Show failure reason on Failed pipelines | None (API already returns it) | Small |
| 2 | DLQ message browser (table view) | None (`getDLQEvents` exists) | Small |
| 3 | State transition timeline from history | New endpoint (simple DB query) | Small |
| 4 | Component-level DLQ error grouping | None (DLQ has component field) | Small |
| 5 | Enhanced status badges with transition info | None (`valid_transitions` in API) | Small |
| 6 | Pipeline config export/download (JSON) | None (full config available) | Tiny |
| 7 | DLQ growth trend (up/down/flat arrow) | None (compute from polling) | Tiny |
| 8 | Richer ClickHouse metrics display | None (data available) | Small |
| 9 | Resource allocation visual overview | None (data available) | Small |
| 10 | Pipeline uptime/age display | None (`created_at` available) | Tiny |

---

## E. Medium-term high-impact features

| # | Improvement | Backend change | Impact |
|---|-------------|------------------|--------|
| 1 | Data flow visualization (component diagram) | Extend health endpoint | High |
| 2 | Kafka consumer lag monitoring | New endpoint | High |
| 3 | Time-series metrics dashboard | Metrics query API | High |
| 4 | Real-time log viewer | Log streaming endpoint | High |
| 5 | Alert rules engine | New subsystem | High |
| 6 | Schema evolution browser | Minor (data exists) | Medium |
| 7 | Pipeline config versioning + diff | History endpoint | Medium |
| 8 | DLQ deep inspection + retry | Extend DLQ API | Medium |

---

## F. Architectural considerations

1. **SSE infrastructure already exists** — the UI has a robust SSE system (`pipeline-sse-manager.ts`) for real-time status. This can be extended to stream metrics, logs, and component health without building new transport.
2. **OTEL metrics are already collected** — the `gfm_*` metrics cover all key pipeline stages. The main gap is a query path from the UI back to wherever these metrics land (Prometheus, Grafana, or a lightweight in-process store).
3. **NATS streams contain rich operational data** — component signals, DLQ messages, queue depths. Exposing these via REST endpoints is straightforward.
4. **The `pipeline_history` table is underutilized** — it stores history/error/status events but there’s no API to query it. This is low-hanging fruit for an activity timeline.
5. **Usage stats collector runs every 10 minutes** — it already gathers per-pipeline metrics from NATS streams. This data could be cached and exposed via API for the UI to display.
