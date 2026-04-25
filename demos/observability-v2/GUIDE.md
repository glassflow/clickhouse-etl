# Detailed Guide — Observability v2 (traces only)

This walkthrough matches the **single-signal** demo: **traces** from TelemetryGen → OTel Collector → GlassFlow (OTLP) → ClickHouse → HyperDX.

## Story: three problems, three places in the pipeline

1. **Duplicates (retries)** — The same logical span may be exported more than once. GlassFlow performs **stateful deduplication** on `span_id` with a **1 hour** window before writes to ClickHouse.
2. **Compliance (PII)** — Span attributes may contain sensitive values. This demo applies **redaction in the OpenTelemetry Collector** using the **transform** processor (OTTL), so GlassFlow and ClickHouse never see raw `user_email` / `demo_ssn` values. (GlassFlow stateless transforms use expr `replace()` as **literal** substring replace, not Python `re`; edge redaction is often done here or in the SDK.)
3. **Cost control (error-prioritized sampling)** — You want **all error traces** and a **small fraction of successful** traces. The collector runs **tail_sampling**: `status_code` policy for `ERROR`, plus **probabilistic 10%** for the remainder. GlassFlow still dedupes whatever arrives.

### Before vs After

- **Before (intent):** TelemetryGen emits ~45 spans/s with `Ok` and ~5 spans/s with `Error`, each with `user_email` and `demo_ssn` attributes. Raw OTLP would show those values and full volume.
- **After (ClickHouse):** Query `otel_traces`: attributes should show `[REDACTED]`, error rows should be far more complete than OK rows relative to ingest, and duplicate `span_id` values within 1h should collapse to one row.

---

## Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                         │
│                                                                    │
│  ┌────────────────────────┐   OTLP/gRPC   ┌─────────────────────┐  │
│  │ TelemetryGen Job       │ ────────────► │ OTel Collector      │  │
│  │ (OK + Error containers)│               │ transform +         │  │
│  └────────────────────────┘               │ tail_sampling       │  │
│                                            └──────────┬──────────┘  │
│                                                       │ OTLP/gRPC   │
│                                                       │ header      │
│                                                       ▼             │
│                                            ┌─────────────────────┐  │
│                                            │ GlassFlow           │  │
│                                            │ dedup (span_id,1h)  │  │
│                                            │ → ClickHouse sink   │  │
│                                            └──────────┬──────────┘  │
│                                                       ▼             │
│                                            ┌─────────────────────┐  │
│                                            │ HyperDX + CH        │  │
│                                            └─────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- `kubectl` against a running cluster (local [kind](https://kind.sigs.k8s.io/) is fine).
- `helm` ≥ 3.12.
- `clickhouse-client` (optional but used for verification SQL).
- About **4 CPU / 8 GB RAM** free for the stack.

---

## Step 0 — Kind cluster (optional)

```bash
make cluster
```

Uses `CLUSTER_NAME` (default `observability-v2`) from the Makefile.

---

## Step 1 — Helm repositories

```bash
make repos
```

Adds **`opentelemetry`**, **`glassflow`**, and **`clickstack`**, then updates **only those three** (`helm repo update opentelemetry glassflow clickstack`) so unrelated repos on your machine (for example a broken **`kubernetes-dashboard`** entry) do not affect `make repos`.

To remove them later: `make repos-remove`.

### GlassFlow chart

The demo default is the published **`glassflow/glassflow-etl`** chart pinned to **`GLASSFLOW_CHART_VERSION=0.5.16`**.

### Align GlassFlow values with the chart (recommended)

Diff your overrides against the chart defaults:

```bash
helm repo update glassflow
helm show values glassflow/glassflow-etl --version 0.5.16
```

The demo file is [`k8s/helm-values/glassflow.values.yaml`](./k8s/helm-values/glassflow.values.yaml) (`sources.otlpReceiver.enabled: true`, kind-sized resources, `ui.kafkaGateway.enabled: false`, etc.).

```bash
helm search repo glassflow/glassflow-etl
helm upgrade --install glassflow glassflow/glassflow-etl --namespace glassflow -f k8s/helm-values/glassflow.values.yaml --version 0.5.16 --wait --timeout 10m
```

---

## Step 2 — Install the stack

```bash
make ns
make install
```

Order: OTel Collector → GlassFlow (`GLASSFLOW_CHART`, default `glassflow/glassflow-etl`) → HyperDX (ClickStack).

```bash
make status
```

---

## Step 3 — GlassFlow API and pipeline

The HTTP API listens on **port 8081** inside the `glassflow-api` service. Forward **local 8080 → 8081** so the default `GLASSFLOW_API_URL=http://localhost:8080` works:

```bash
make pf-glassflow-api
```

In another shell:

```bash
make deploy-pipelines
```

This POSTs [`glassflow-pipelines/traces-pipeline.json`](./glassflow-pipelines/traces-pipeline.json). Its shape follows the current V3 docs: root **`version`: `"v3"`**, **`sources[]`** with **`type: "otlp.traces"`** and **`source_id`**, a **`transforms[]`** dedup step on **`span_id`**, ClickHouse **`sink.connection_params`**, and sink-level **`mapping`**. OTLP sources do not define **`schema_fields`** because GlassFlow uses the predefined OTLP schema, and the API rejects source-level resource overrides for OTLP sources. `ServiceName` is derived in ClickHouse from `ResourceAttributes['service.name']` because this API exposes `resource_attributes` but rejects `resource_attributes.service.name` as a mapping field. `events` and `links` are stored as `Array(Map(String, String))` because the sink validator does not accept ClickHouse `Nested(...)` target types.

---

## Step 4 — ClickHouse schema

Forward ClickHouse (bundled in ClickStack):

```bash
kubectl port-forward -n hyperdx svc/hyperdx-clickstack-clickhouse 9000:9000
```

```bash
make create-clickhouse-tables
```

Only **`otel_traces`** is created (see [`clickhouse/create_otel_tables.sql`](./clickhouse/create_otel_tables.sql)). The script also updates an existing table so `ServiceName`, `Events`, and `Links` match the current pipeline mapping.

---

## Step 5 — Synthetic traces

```bash
make telemetry
```

The Job [`k8s/telemetry/telemetrygen-traces.yaml`](./k8s/telemetry/telemetrygen-traces.yaml) runs **two** `telemetrygen` containers in one pod:

| Container | Approx. rate | Status | Attributes (demo PII) |
| --- | --- | --- | --- |
| `telemetrygen-ok` | 45/s | Ok | `user_email`, `demo_ssn` |
| `telemetrygen-error` | 5/s | Error | `user_email`, `demo_ssn` |

---

## Step 6 — UIs

```bash
make pf-glassflow    # GlassFlow UI → http://localhost:8081 (local 8081 → pod 8080)
make pf-hyperdx      # HyperDX      → http://localhost:8090
```

Keep `pf-glassflow-api` running if you still need the API on `http://localhost:8080`.

In GlassFlow, open **Pipelines** and confirm **`otlp-traces`** is running. In HyperDX, open **Traces**.

---

## Step 7 — Verify in ClickHouse

Use ClickStack's in-cluster ClickHouse service user:

```bash
kubectl exec -n hyperdx deploy/hyperdx-clickstack-clickhouse -- \
  clickhouse-client \
    --host=hyperdx-clickstack-clickhouse.hyperdx.svc.cluster.local \
    --user=otelcollector \
    --password=otelcollectorpass
```

If you have a local `clickhouse-client` and a `9000:9000` port-forward active, use the local default user instead: `clickhouse-client --port 9000 --user default`.

### Volume and sampling (after tail_sampling + GlassFlow)

Rough generator mix: ~90% Ok / ~10% Error **before** the collector. Tail sampling keeps **100%** of error traces (by policy) and **~10%** of traces that only match the probabilistic policy, so you expect **many more ERROR rows per capita** than OK rows in `otel_traces` relative to the generator.

```sql
SELECT StatusCode, count() AS n
FROM otel_traces
GROUP BY StatusCode
ORDER BY n DESC;
```

### Dedupe on `span_id` (within GlassFlow window)

```sql
SELECT SpanId, count() AS c
FROM otel_traces
GROUP BY SpanId
HAVING c > 1
LIMIT 20;
```

Expect **no rows** (or only transient doubles if you query mid-batch before dedupe settles).

### Masking (collector transform)

```sql
SELECT
  countIf(mapContains(ResourceAttributes, 'user_email') AND ResourceAttributes['user_email'] = '[REDACTED]') AS redacted_email,
  countIf(mapContains(ResourceAttributes, 'demo_ssn') AND ResourceAttributes['demo_ssn'] = '[REDACTED]') AS redacted_ssn,
  count() AS total
FROM otel_traces;
```

You should **not** see raw `alice@example.com`, `bob@example.com`, or SSN-like strings in those map values.

---

## Step 8 — Clean up

```bash
make telemetry-remove
make uninstall
make ns-remove
make cluster-delete
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Helm cannot find the GlassFlow chart | Missing or stale `glassflow` repo | Run `make repos`, or `helm repo add glassflow https://glassflow.github.io/charts && helm repo update glassflow` |
| GlassFlow pods `Pending` | Insufficient CPU/memory | Increase kind node resources |
| No traces in HyperDX | Collector → GlassFlow connectivity | `kubectl get svc -n glassflow glassflow-otlp-receiver`; check `x-glassflow-pipeline-id: otlp-traces` in `otel-collector.values.yaml` |
| `deploy-pipelines` fails | API not reachable, 409 conflict, or 422 validation | Run `make pf-glassflow-api` first. **HTTP 409** means **pipeline id already exists**. **HTTP 422** means the JSON did not match the API schema; confirm it uses `sources[]`, `source_id`, `transforms[]`, `sink.connection_params`, and `sink.mapping` |
| `transform` / `tail_sampling` errors on startup | Collector contrib version / YAML | Confirm image `otel/opentelemetry-collector-contrib:0.120.0` matches the config keys in [`k8s/helm-values/otel-collector.values.yaml`](./k8s/helm-values/otel-collector.values.yaml) |

---

## v1 demo comparison

| Aspect | v1 (Kafka) | v2 (this demo) |
| --- | --- | --- |
| Broker | Kafka required | None |
| Signals | Logs + metrics + traces (v1 scope) | **Traces only** |
| Sampling / PII | Not highlighted | OTel **tail_sampling** + **transform** |
| Dedupe | GlassFlow post-Kafka | GlassFlow on OTLP stream (`span_id`, 1h) |

---

## Filter semantics (GlassFlow)

If you add a **`filter`** transform later, the expression must evaluate to a **boolean**. In the processor, records where the expression evaluates to **`true` are kept** (see `FilterProcessor` in the GlassFlow API codebase). This demo relies on **tail_sampling** in the collector instead of a GlassFlow filter because stable `trace_id` hashing is not available in vanilla expr for this path.
