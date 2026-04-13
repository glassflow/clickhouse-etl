# Observability Stack v2 — OTel + GlassFlow + ClickHouse + HyperDX

A Kafka-free observability pipeline using the **GlassFlow OTel Connector**.

```
TelemetryGen → OTel Collector → GlassFlow (OTLP) → ClickHouse → HyperDX
```

Compared to the [v1 demo](../observability), this version removes Apache Kafka entirely. GlassFlow's built-in OTLP ingestor receives telemetry data directly from the OTel Collector, performing real-time deduplication, schema mapping, and batched writes to ClickHouse — with no broker in between.

## Requirements

| Resource | Minimum |
|----------|---------|
| CPU      | 4 cores |
| RAM      | 8 GB    |
| Disk     | 10 GB   |

**Tools:** `kubectl`, `helm`, `kind` (or any K8s cluster), `clickhouse-client`

## Quick Start

```bash
# 1. Create a local cluster (skip if you have one)
kind create cluster --name observability

# 2. Deploy the full stack
make deploy-stack

# 3. Open the UIs (run each in a separate terminal)
make pf-glassflow   # GlassFlow UI → http://localhost:8080
make pf-hyperdx     # HyperDX UI  → http://localhost:8090

# 4. Check pod status
make status

# 5. Tear everything down
make uninstall && make ns-remove
```

## What Gets Deployed

| Component           | Namespace  | Purpose                                      |
|---------------------|------------|----------------------------------------------|
| OTel Collector      | `otel`     | Receives OTLP, routes signals to GlassFlow   |
| GlassFlow           | `glassflow`| OTLP ingestor, deduplication, ClickHouse sink|
| HyperDX + ClickHouse| `hyperdx`  | Storage and visualization                    |
| TelemetryGen (Jobs) | `otel`     | Synthetic logs, traces, and metrics          |

## GlassFlow Pipelines

Three pipelines are deployed via the GlassFlow API:

| Pipeline          | Source Type    | Sink Table    |
|-------------------|----------------|---------------|
| `otlp-logs`       | `otlp.logs`    | `otel_logs`   |
| `otlp-metrics`    | `otlp.metrics` | `otel_metrics`|
| `otlp-traces`     | `otlp.traces`  | `otel_traces` |

See [`glassflow-pipelines/`](./glassflow-pipelines/) for the pipeline configuration files and [`clickhouse/create_otel_tables.sql`](./clickhouse/create_otel_tables.sql) for the table schemas.

## Documentation

- [GUIDE.md](./GUIDE.md) — Detailed walkthrough with architecture diagrams and verification steps
- [GlassFlow OTel Connector docs](https://docs.glassflow.dev)
- [OpenTelemetry Collector Helm chart](https://github.com/open-telemetry/opentelemetry-helm-charts)
