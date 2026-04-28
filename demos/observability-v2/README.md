# Observability Stack v2 — OTel + GlassFlow + ClickHouse + HyperDX

A **traces-only** observability demo: synthetic spans flow through the OpenTelemetry Collector (masking + tail sampling), then through **GlassFlow** over OTLP (stateful **deduplication** on `span_id`), into **ClickHouse**, viewable in **HyperDX**.

```text
TelemetryGen → OTel Collector → GlassFlow (OTLP) → ClickHouse → HyperDX
```

There is **no Kafka**. GlassFlow’s OTLP receiver accepts gRPC from the collector; routing uses the `x-glassflow-pipeline-id: otlp-traces` header.

GlassFlow is installed from the published Helm chart by default: **`glassflow/glassflow-etl`** at chart version **`0.5.16`**. The OTLP receiver is enabled in [`k8s/helm-values/glassflow.values.yaml`](./k8s/helm-values/glassflow.values.yaml), matching the [GlassFlow OTLP source docs](https://docs.glassflow.dev/sources/otlp). Smoke-test rendering without a cluster: **`make test-glassflow-chart`**.

## What this demo shows

| Problem | Where it is handled | What to verify |
| --- | --- | --- |
| Retry / duplicate spans | GlassFlow dedupe (`span_id`, 1h window) | ClickHouse: no duplicate `span_id` within the TTL window |
| Compliance masking | OTel **transform** processor (span attributes) | `user_email` / `demo_ssn` in `SpanAttributes` are redacted |
| Cost / noise (keep errors, sample OK) | OTel **tail_sampling** (~10% non-errors + all `ERROR`) | Ratio of `StatusCode` in `otel_traces` vs generator rates |

GlassFlow’s filter expressions use [expr-lang](https://expr-lang.org/) without regex replace on arbitrary strings; **regex-style** redaction belongs in the collector (as here) or another edge component. See [GUIDE.md](./GUIDE.md) for details.

## Requirements

| Resource | Minimum |
|----------|---------|
| CPU      | 4 cores |
| RAM      | 8 GB    |
| Disk     | 10 GB   |

**Tools:** `kubectl`, `helm`, `kind` (or any Kubernetes cluster), `clickhouse-client`

## Quick Start

```bash
# 1. Create a local cluster (skip if you already have one)
make cluster

# 2. Deploy Helm releases from published charts
make test-glassflow-chart   # optional: helm template smoke test
make repos
make install

# 3. Create ClickHouse table, then create the pipeline
kubectl port-forward -n hyperdx svc/hyperdx-clickstack-clickhouse 9000:9000   # terminal 1
make create-clickhouse-tables
make pf-glassflow-api   # terminal 2 — http://localhost:8080 → API :8081
make deploy-pipelines   # uses GLASSFLOW_API_URL=http://localhost:8080 by default

# 4. Start synthetic traces
make telemetry

# 5. Open UIs (GlassFlow UI uses local 8081 so the API can keep local 8080)
make pf-glassflow   # terminal 3 — GlassFlow UI → http://localhost:8081
make pf-hyperdx     # terminal 4 — HyperDX → http://localhost:8090

# 6. Status and teardown
make status
make telemetry-remove && make uninstall && make ns-remove
make cluster-delete
```

If **port 8080** is busy, forward the API on another port, for example  
`kubectl port-forward -n glassflow svc/glassflow-api 18080:8081`  
then `GLASSFLOW_API_URL=http://localhost:18080 make deploy-pipelines`.

## What Gets Deployed

| Component | Namespace | Purpose |
| --- | --- | --- |
| OTel Collector | `otel` | Receives OTLP, redacts attributes, tail-samples, exports traces to GlassFlow |
| GlassFlow | `glassflow` | OTLP ingest, `span_id` deduplication, ClickHouse sink |
| HyperDX + ClickHouse | `hyperdx` | Storage and UI |
| TelemetryGen Job | `otel` | Two containers: mostly OK spans + fewer ERROR spans, with demo PII attributes |

## GlassFlow pipeline

A single pipeline **`otlp-traces`** is defined in [`glassflow-pipelines/traces-pipeline.json`](./glassflow-pipelines/traces-pipeline.json): `version` v3, `sources[]` with `otlp.traces`, a `dedup` transform on `span_id`, ClickHouse `sink.connection_params`, and sink-level `mapping`. The ClickHouse DDL is [`clickhouse/create_otel_tables.sql`](./clickhouse/create_otel_tables.sql) (`otel_traces` only) using ClickStack-compatible trace column names; `ServiceName` is derived from `ResourceAttributes['service.name']`, while `Events` and `Links` use `Array(Map(String, String))`.

## Documentation

- [GUIDE.md](./GUIDE.md) — Walkthrough, `helm show values` alignment notes, and verification SQL
- [GlassFlow docs](https://docs.glassflow.dev)
- [OpenTelemetry Collector Helm chart](https://github.com/open-telemetry/opentelemetry-helm-charts)
- Published GlassFlow chart index: [glassflow/charts](https://github.com/glassflow/charts)
