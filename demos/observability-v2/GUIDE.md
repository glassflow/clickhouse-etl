# Detailed Guide — Observability Stack v2 (GlassFlow OTel Connector)

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                         │
│                                                                    │
│  ┌───────────────┐    OTLP (gRPC)    ┌──────────────────────────┐  │
│  │ TelemetryGen  │ ────────────────► │    OTel Collector        │  │
│  │ (logs/traces/ │                   │  (namespace: otel)       │  │
│  │  metrics)     │                   └──────────┬───────────────┘  │
│  └───────────────┘                              │ OTLP per signal  │
│                                                 ▼                  │
│                                  ┌──────────────────────────────┐  │
│                                  │         GlassFlow            │  │
│                                  │   (namespace: glassflow)     │  │
│                                  │                              │  │
│                                  │  ┌────────┐  ┌────────────┐  │  │
│                                  │  │ OTLP   │  │  Pipeline  │  │  │
│                                  │  │Ingestor│─►│  Engine    │  │  │
│                                  │  └────────┘  │ • Dedup    │  │  │
│                                  │              │ • Schema   │  │  │
│                                  │              │ • Batch    │  │  │
│                                  │              └─────┬──────┘  │  │
│                                  └────────────────────┼─────────┘  │
│                                                       │ Native     │
│                                                       ▼ Protocol   │
│                                  ┌──────────────────────────────┐  │
│                                  │  ClickHouse + HyperDX        │  │
│                                  │  (namespace: hyperdx)        │  │
│                                  └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **TelemetryGen** (Kubernetes Jobs) emit synthetic logs, traces, and metrics via OTLP/gRPC to the OTel Collector.
2. **OTel Collector** forwards each signal type to the GlassFlow unified OTLP receiver over OTLP/gRPC, using the `x-glassflow-pipeline-id` header to route data to the correct pipeline.
3. **GlassFlow** ingests OTLP data natively, applies real-time deduplication (traces), performs schema type coercion, and batch-writes records to ClickHouse.
4. **ClickStack** (HyperDX + embedded ClickHouse) provides a Datadog-style UI for searching logs, traces, and metrics.

> **Key difference from v1:** Apache Kafka is completely absent. There is no broker to provision, no topics to create, and no custom OTel Collector exporter plugin required.

---

## Prerequisites

- `kubectl` configured against a running cluster (local [`kind`](https://kind.sigs.k8s.io/) works fine)
- `helm` ≥ 3.12
- `clickhouse-client` (for running the schema SQL)
- Minimum 4 CPU cores / 8 GB RAM available

---

## Step 0 — Create a Kind Cluster (optional)

```bash
kind create cluster --name observability-v2
```

---

## Step 1 — Add Helm Repositories

```bash
make repos
```

This adds the `opentelemetry`, `glassflow`, and `clickstack` Helm repositories.

---

## Step 2 — Deploy the Stack

```bash
make install
```

This deploys three Helm releases in order:

| Release   | Chart                                        | Namespace   |
|-----------|----------------------------------------------|-------------|
| `otel`    | `opentelemetry/opentelemetry-collector`      | `otel`      |
| `glassflow` | `glassflow/glassflow`                      | `glassflow` |
| `hyperdx` | `clickstack/clickstack`                      | `hyperdx`   |

Each `helm upgrade --install` call includes `--wait`, so the command blocks until all pods are Ready.

### Verify

```bash
make status
```

All pods should show `Running` or `Completed`. Typical startup time is 3–5 minutes on a local cluster.

---

## Step 3 — Create ClickHouse Tables

```bash
# Port-forward ClickHouse first (it runs inside the clickstack release)
kubectl port-forward -n hyperdx svc/hyperdx-clickstack-clickhouse 9000:9000 &

make create-clickhouse-tables
```

This creates three tables in the `default` database:

| Table          | Contents                                    |
|----------------|---------------------------------------------|
| `otel_logs`    | Log records with severity, body, attributes |
| `otel_traces`  | Spans with timing, status, events, links    |
| `otel_metrics` | Unified table for Gauge, Sum, Histogram     |

> The schema in `clickhouse/create_otel_tables.sql` uses a **unified metrics table** (`otel_metrics`) instead of separate per-type tables. This simplifies the pipeline configuration while still supporting all metric types via nullable/array columns.

---

## Step 4 — Deploy GlassFlow Pipelines

```bash
# Port-forward the GlassFlow API
kubectl port-forward -n glassflow svc/glassflow-api 8080:8081 &

make deploy-pipelines
```

This POSTs three pipeline definitions to the GlassFlow API:

### Logs pipeline (`otlp-logs`)

```json
{
  "source": { "type": "otlp.logs" },
  "sink":   { "table": "otel_logs", "max_batch_size": 30000, "max_delay_time": "5s" }
}
```

### Metrics pipeline (`otlp-metrics`)

```json
{
  "source": { "type": "otlp.metrics" },
  "sink":   { "table": "otel_metrics", "max_batch_size": 30000, "max_delay_time": "5s" }
}
```

### Traces pipeline (`otlp-traces`)

```json
{
  "source": {
    "type": "otlp.traces",
    "deduplication": { "enabled": true, "key": "trace_id", "time_window": "10m0s" }
  },
  "sink": { "table": "otel_traces", "max_batch_size": 30000, "max_delay_time": "5s" }
}
```

After each pipeline is created, GlassFlow routes data through its unified OTLP receiver service (`glassflow-otlp-receiver`). The OTel Collector values (`k8s/helm-values/otel-collector.values.yaml`) are pre-configured with separate exporters per signal type, each including the required `x-glassflow-pipeline-id` header to route data to the correct pipeline.

---

## Step 5 — Start Synthetic Telemetry

```bash
make telemetry
```

Deploys four Kubernetes Jobs that emit 50 records/second each for 50 minutes:

- `telemetrygen-logs` — log records
- `telemetrygen-traces` — distributed trace spans
- `telemetrygen-metrics-gauge` — gauge metrics (5 unique series)
- `telemetrygen-metrics-sum` — monotonic sum metrics (5 unique series, cumulative temporality)

---

## Step 6 — Access the UIs

Open two terminals:

```bash
# Terminal 1
make pf-glassflow    # GlassFlow UI: http://localhost:8080

# Terminal 2
make pf-hyperdx      # HyperDX UI:  http://localhost:8090 (ClickStack)
```

### GlassFlow UI

- Navigate to **Pipelines**. You should see `otlp-logs`, `otlp-metrics`, and `otlp-traces` in a `Running` state.
- Click a pipeline to see real-time throughput metrics and schema details.

### HyperDX UI

- Open **Logs** — you should see `telemetrygen` log records flowing in within ~30 seconds.
- Open **Traces** — distributed spans appear deduplicated (no duplicate `trace_id` rows in ClickHouse).
- Open **Dashboards** and create a chart from `otel_metrics` to plot `gen-gauge` or `gen-sum` over time.

---

## Step 7 — Verify Data in ClickHouse

```bash
kubectl port-forward -n hyperdx svc/hyperdx-clickstack-clickhouse 9000:9000 &
clickhouse-client --port 9000 --user otel --password password
```

```sql
-- Count records per table
SELECT 'logs'    AS tbl, count() FROM otel_logs    UNION ALL
SELECT 'traces'  AS tbl, count() FROM otel_traces   UNION ALL
SELECT 'metrics' AS tbl, count() FROM otel_metrics;

-- Confirm no duplicate trace spans
SELECT trace_id, count() AS span_count
FROM otel_traces
GROUP BY trace_id
ORDER BY span_count DESC
LIMIT 10;

-- Recent log records
SELECT timestamp, severity_text, body
FROM otel_logs
ORDER BY timestamp DESC
LIMIT 20;
```

---

## Step 8 — Clean Up

```bash
make telemetry-remove
make uninstall
make ns-remove
kind delete cluster --name observability-v2
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| GlassFlow pods `Pending` | Insufficient cluster resources | Increase kind node memory / CPU |
| No data in HyperDX | OTel Collector can't reach GlassFlow OTLP receiver | Check `kubectl get svc -n glassflow` for `glassflow-otlp-receiver` and verify `x-glassflow-pipeline-id` headers in `otel-collector.values.yaml` |
| `deploy-pipelines` returns 4xx | GlassFlow API port-forward not active | Run `kubectl port-forward -n glassflow svc/glassflow-api 8080:8081` first |
| ClickHouse table creation fails | ClickHouse port-forward not active | Run `kubectl port-forward -n hyperdx svc/hyperdx-clickstack-clickhouse 9000:9000` first |

---

## Architecture Comparison: v1 vs v2

| Aspect               | v1 (with Kafka)            | v2 (GlassFlow OTel Connector) |
|----------------------|----------------------------|-------------------------------|
| Components           | OTel Collector + Kafka + GlassFlow + ClickHouse | OTel Collector + GlassFlow + ClickHouse |
| Namespaces           | 4 (`kafka`, `otel`, `glassflow`, `hyperdx`) | 3 (`otel`, `glassflow`, `hyperdx`) |
| OTel Collector image | Custom (`glassflow/otelcontribcol`) | Standard `otel/opentelemetry-collector-contrib` |
| Kafka cluster        | Required (KRaft, 1 broker) | Not needed                    |
| Topic management     | Manual topic creation      | None                          |
| Latency              | Higher (broker hop)        | Lower (direct OTLP stream)    |
| Deduplication        | GlassFlow (post-Kafka)     | GlassFlow (in-stream)         |
| Metrics tables       | 4 separate tables          | 1 unified `otel_metrics` table|
