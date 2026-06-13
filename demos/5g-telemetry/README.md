# 5G RAN Signal Quality — OTel + GlassFlow + ClickHouse

Replay real 5G UE-side traces from [`uccmisl/5Gdataset`](https://github.com/uccmisl/5Gdataset) as OpenTelemetry gauge metrics. Two redundant OTel Collectors (HA pair simulation) forward duplicates to **GlassFlow** over OTLP. GlassFlow **filters** health-check noise, **deduplicates** overlapping collector emissions, **normalizes** vendor-specific cell ID attributes, and writes clean metrics to **ClickHouse** for Grafana dashboards.

```text
5G Emitter → OTel Collector A ─┐
                                ├→ GlassFlow (OTLP) → ClickHouse → Grafana
5G Emitter → OTel Collector B ─┘
```

There is **no Kafka**. GlassFlow's OTLP receiver accepts HTTP/JSON on port 4318; routing uses `x-glassflow-pipeline-id: 5g-telemetry-pipeline`.

## What this demo shows

| Problem | Where it is handled | What to verify |
| --- | --- | --- |
| Duplicate metrics from HA collector pairs | GlassFlow dedup (composite cell + metric + timestamp key, 30s window) | ClickHouse row counts ~2× lower vs dedup-off pipeline |
| Vendor attribute naming drift (`cell.id` vs `ran.cell.id`) | GlassFlow stateless normalization → `canonical_cell_id` | Single `CellID` column regardless of collector |
| Health-check noise | GlassFlow filter (`event_kind != healthcheck`) | No `ran.healthcheck` rows in ClickHouse |
| SLA-ready signal analytics | ClickHouse + Grafana | RSRP timeline, throughput heatmap, breach indicator |

## Dataset

This demo uses the public [**5Gdataset**](https://github.com/uccmisl/5Gdataset) from University College Cork (~189k rows, 83 CSVs, 274 cells). The emitter **downloads the dataset automatically** at runtime from GitHub. You can also clone it locally:

```bash
git clone https://github.com/uccmisl/5Gdataset.git
```

Citation: D. Raca et al., *Beyond Throughput, The Next Generation: A 5G Dataset with Channel and Context Metrics*, MMSys 2020.

## Requirements

| Resource | Minimum |
|----------|---------|
| CPU      | 6 cores |
| RAM      | 8 GB    |
| Disk     | 15 GB   |

**Tools:** `kubectl`, `helm`, `kind`, `docker`, `curl` (optional: `clickhouse-client`)

## Quick Start

```bash
cd demos/5g-telemetry

# 1. Create a local cluster
make cluster

# 2. Deploy the stack (ClickHouse, dual OTel collectors, GlassFlow, Grafana)
make repos
make test-glassflow-chart   # optional smoke test (requires make repos)
make test-clickstack-chart  # optional smoke test (requires make repos)
make install

# 3. Create ClickHouse table and deploy the GlassFlow pipeline
make pf-clickhouse          # terminal 1 — localhost:9000 / :8123
make create-clickhouse-tables
make pf-glassflow-api       # terminal 2 — http://localhost:8081
make deploy-pipeline

# 4. Build and run the 5G dataset replay emitter
make emitter                # downloads dataset inside the Job, replays to both collectors

# 5. Open UIs
make pf-glassflow           # terminal 3 — GlassFlow UI → http://localhost:8080
make pf-grafana             # terminal 4 — Grafana → http://localhost:3000 (admin/admin)

# 6. Status and teardown
make status
make teardown && make cluster-delete
```

To compare **dedup ON vs OFF**, truncate `ran_metrics`, deploy the no-dedup pipeline, re-run the emitter, and compare counts — see [GUIDE.md](./GUIDE.md).

## What Gets Deployed

| Component | Namespace | Purpose |
| --- | --- | --- |
| ClickHouse (ClickStack) | `clickhouse` | Storage for cleaned RAN metrics |
| OTel Collector A | `otel` | Receives emitter OTLP; exports `cell.id` naming to GlassFlow |
| OTel Collector B | `otel` | Receives emitter OTLP; exports `ran.cell.id` naming to GlassFlow |
| GlassFlow | `glassflow` | OTLP ingest, filter, dedup, normalization, ClickHouse sink |
| Grafana | `grafana` | Dashboards for RSRP, throughput, SLA breach |
| 5G Emitter Job | `otel` | Downloads 5Gdataset, replays CSV rows as OTLP gauge metrics |

## GlassFlow pipeline

Pipeline **`ran-5g-telemetry`** is defined in [`glassflow-pipelines/5g-metrics-pipeline.json`](./glassflow-pipelines/5g-metrics-pipeline.json):

1. **Filter** — drop `ran.healthcheck` metrics
2. **Dedup** — key on the `measurement_id` data-point attribute (`attributes.measurement_id`, 30s window). The emitter stamps each observation with a stable `measurement_id`, identical across both HA collectors, so the redundant copy is removed. (GlassFlow's dedup `key` must be a single existing field, and dedup runs before the stateless stage — hence the emitter pre-computes the identity.)
3. **Stateless** — normalize to `canonical_cell_id`, extract lat/lon and network mode
4. **ClickHouse sink** — typed mapping to `ran_metrics` table

A companion pipeline used for the dedup ON/OFF comparison is in [`glassflow-pipelines/5g-metrics-pipeline-no-dedup.json`](./glassflow-pipelines/5g-metrics-pipeline-no-dedup.json); it omits the `dedup` transform entirely (keeping only `filter` and `stateless`), so both collector copies survive and counts roughly double.

## Documentation

- [GUIDE.md](./GUIDE.md) — Detailed walkthrough, verification SQL, dedup comparison
- [GlassFlow OTLP source docs](https://docs.glassflow.dev/sources/otlp)
- [GlassFlow deduplication docs](https://docs.glassflow.dev/transformations/deduplication)
- [5Gdataset repository](https://github.com/uccmisl/5Gdataset)
