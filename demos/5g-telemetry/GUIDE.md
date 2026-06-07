# 5G Telemetry Demo — Detailed Guide

This guide walks through the full demo stack, verification queries, and the dedup ON vs OFF comparison described in the companion article.

## Architecture

```text
┌─────────────────┐     OTLP/HTTP      ┌──────────────────────┐
│  5G Emitter Job │ ──────────────────→│ OTel Collector A     │
│  (Python)       │                    │ (cell.id naming)     │
│                 │     OTLP/HTTP      └──────────┬───────────┘
│  Downloads      │ ──────────────────→┌──────────┴───────────┐
│  uccmisl/       │                    │ OTel Collector B     │
│  5Gdataset      │                    │ (ran.cell.id naming) │
└─────────────────┘                    └──────────┬───────────┘
                                                │ OTLP/HTTP
                                                │ x-glassflow-pipeline-id
                                                ▼
                                     ┌──────────────────────┐
                                     │ GlassFlow            │
                                     │ 1. Filter            │
                                     │ 2. Dedup (30s)       │
                                     │ 3. Normalize attrs   │
                                     │ 4. ClickHouse sink   │
                                     └──────────┬───────────┘
                                                ▼
                                     ┌──────────────────────┐
                                     │ ClickHouse           │
                                     │ ran_metrics table    │
                                     └──────────┬───────────┘
                                                ▼
                                     ┌──────────────────────┐
                                     │ Grafana              │
                                     └──────────────────────┘
```

## Step 1 — Prepare the dataset

The emitter Job downloads the dataset automatically from GitHub:

```
https://github.com/uccmisl/5Gdataset/raw/master/5G-production-dataset.zip
```

If you prefer to pre-stage the data locally for faster replays, clone the repository:

```bash
git clone https://github.com/uccmisl/5Gdataset.git /tmp/5Gdataset
```

Then mount it into the emitter Job by editing [`k8s/telemetry/5g-emitter-job.yaml`](./k8s/telemetry/5g-emitter-job.yaml) to use a hostPath or PVC instead of `emptyDir`.

### Dataset columns used

| CSV Column | OTLP Metric | Unit |
| --- | --- | --- |
| `RSRP` | `ran.rsrp` | dBm |
| `RSRQ` | `ran.rsrq` | dB |
| `SNR` | `ran.snr` | dB |
| `CQI` | `ran.cqi` | 1 |
| `DL_bitrate` | `ran.dl_bitrate` | kbps |
| `UL_bitrate` | `ran.ul_bitrate` | kbps |

Resource attributes vary by collector:

- **Collector A:** `cell.id`, `network.mode`, `location.latitude`, `location.longitude`
- **Collector B:** `ran.cell.id`, `network.mode`, `location.latitude`, `location.longitude`

## Step 2 — Deploy the stack

```bash
make cluster
make repos
make install
```

Wait for all pods to reach `Running`:

```bash
make status
kubectl wait --for=condition=ready pod --all -n glassflow --timeout=600s
```

## Step 3 — Create ClickHouse schema

Port-forward ClickHouse (if not using in-cluster client):

```bash
make pf-clickhouse
```

Apply the DDL:

```bash
make create-clickhouse-tables
```

Verify:

```sql
SHOW CREATE TABLE ran_metrics;
```

## Step 4 — Deploy the GlassFlow pipeline

Port-forward the GlassFlow API:

```bash
make pf-glassflow-api
```

Deploy the dedup-enabled pipeline:

```bash
make deploy-pipeline
```

Confirm in the GlassFlow UI (`make pf-glassflow` → http://localhost:8081) that pipeline `ran-5g-telemetry` is active.

### Transform execution order

GlassFlow applies transforms in this fixed order regardless of JSON array order:

1. **Filter** — drops health-check metrics before dedup state is consumed
2. **Dedup** — keys on the `measurement_id` data-point attribute (`attributes.measurement_id`). The dedup `key` must be a single existing field, and dedup runs before the stateless stage, so the emitter stamps each measurement with a stable `measurement_id` (a hash of cell + metric + base timestamp). Both HA collectors emit the **same** `measurement_id` for the same observation, so the redundant copy is removed.
3. **Stateless** — writes `canonical_cell_id` for the ClickHouse sink

## Step 5 — Run the emitter

```bash
make emitter
```

Watch progress:

```bash
kubectl logs -n otel -l app=5g-emitter -f
```

The default Job replays **10,000 rows** (`MAX_ROWS` env var). To replay the full dataset, edit the Job manifest and remove or increase `MAX_ROWS`.

## Step 6 — Verify in ClickHouse

Connect via port-forward or in-cluster client:

```bash
clickhouse-client --host localhost --port 9000 --user otelcollector --password otelcollectorpass
```

### Row counts by metric

```sql
SELECT MetricName, count() AS rows
FROM ran_metrics
GROUP BY MetricName
ORDER BY rows DESC;
```

Health-check metrics should be absent (`ran.healthcheck` filtered upstream).

### Signal degradation (RSRP below -110 dBm)

```sql
SELECT
    CellID,
    toStartOfMinute(TimeUnix) AS minute,
    avg(Value) AS avg_rsrp
FROM ran_metrics
WHERE MetricName = 'ran.rsrp'
GROUP BY CellID, minute
HAVING avg_rsrp < -110
ORDER BY minute DESC, avg_rsrp ASC
LIMIT 50;
```

### Throughput SLA (p95 DL bitrate per cell)

```sql
SELECT
    CellID,
    quantile(0.95)(Value) AS p95_dl_kbps
FROM ran_metrics
WHERE MetricName = 'ran.dl_bitrate'
GROUP BY CellID
ORDER BY p95_dl_kbps DESC
LIMIT 20;
```

## Step 7 — Grafana dashboard

```bash
make pf-grafana
```

Open http://localhost:3000 (credentials: `admin` / `admin`).

Import or browse the pre-provisioned dashboard **5G RAN Signal Quality** under folder **5G Telemetry**. Panels include:

- Per-cell RSRP timeline
- Downlink throughput heatmap by cell
- SLA breach indicator (cells with 1-minute RSRP average below -110 dBm)
- DL throughput metric count by cell

## Step 8 — Dedup ON vs OFF comparison

This demonstrates why duplicate collector emissions inflate counts ~2×.

### A. Baseline with dedup ON (already done)

```sql
SELECT CellID, count() AS dedup_on_count
FROM ran_metrics
WHERE MetricName = 'ran.rsrp'
GROUP BY CellID
ORDER BY dedup_on_count DESC
LIMIT 6;
```

Record the counts.

### B. Truncate and redeploy without dedup

```sql
TRUNCATE TABLE ran_metrics;
```

Deploy the no-dedup pipeline and point collectors at it:

```bash
make deploy-pipeline-no-dedup
make switch-collectors-no-dedup
make emitter
```

> **How "no dedup" is modeled.** GlassFlow only runs the filter/stateless processing
> component when a `dedup` transform is present, so the comparison pipeline still has a
> `dedup` stage — but it keys on `attributes.emission_id` instead of
> `attributes.measurement_id`. Each physical emission carries a **unique** `emission_id`
> (the measurement identity plus the collector name), so no records are ever removed and
> both collector copies survive. The real pipeline keys on the **shared**
> `measurement_id`, so the redundant copy collapses.

### C. Compare inflation factor

```sql
SELECT
    CellID,
    count() AS dedup_off_count,
    uniqExact(Attributes['measurement_id']) AS unique_measurements,
    count() / greatest(uniqExact(Attributes['measurement_id']), 1) AS inflation_factor
FROM ran_metrics
WHERE MetricName = 'ran.rsrp'
GROUP BY CellID
ORDER BY inflation_factor DESC
LIMIT 6;
```

Each observation carries a stable `measurement_id`, and both HA collectors emit the same `measurement_id` for the same observation. With dedup OFF, both copies land in ClickHouse, so `count()` is roughly twice the number of unique measurements and `inflation_factor ≈ 2.0`. With dedup ON, `count()` equals `unique_measurements` and the factor drops to `1.0`.

## Troubleshooting

### Emitter Job fails to download dataset

Ensure the cluster has outbound network access. As a fallback, clone the dataset locally and mount it — see Step 1.

### Pipeline deploy returns 409

Pipeline ID already exists. Delete the existing pipeline in the GlassFlow UI or use a new `pipeline_id` in the JSON.

### Pipeline deploy returns connection error

Run `make pf-glassflow-api` in a separate terminal before `make deploy-pipeline`.

### No rows in ClickHouse

1. Check emitter logs: `kubectl logs -n otel -l app=5g-emitter`
2. Check GlassFlow pipeline status in the UI
3. Verify collectors reach GlassFlow: `kubectl logs -n otel deploy/otel-collector-a`

### Grafana shows no data

1. Confirm rows exist: `SELECT count() FROM ran_metrics`
2. Adjust the dashboard time range — dataset timestamps are from **2019-12-16** (Grafana dashboard defaults to that window)

## File reference

| Path | Purpose |
| --- | --- |
| `emitter/emitter.py` | CSV → OTLP/HTTP JSON replay script |
| `glassflow-pipelines/5g-metrics-pipeline.json` | Full v3 pipeline with dedup |
| `glassflow-pipelines/5g-metrics-pipeline-no-dedup.json` | Comparison pipeline |
| `clickhouse/create_otel_tables.sql` | `ran_metrics` DDL + sample queries |
| `sql/verification_queries.sql` | ClickHouse verification and comparison queries |
| `grafana/5g-dashboard.json` | Grafana dashboard definition |
| `k8s/helm-values/*.values.yaml` | Helm overrides for all components |
| `k8s/telemetry/5g-emitter-job.yaml` | Kubernetes Job manifest |

## References

- [GlassFlow OTLP source](https://docs.glassflow.dev/sources/otlp)
- [GlassFlow deduplication](https://docs.glassflow.dev/transformations/deduplication)
- [GlassFlow stateless transforms](https://docs.glassflow.dev/transformations/stateless-transformation)
- [GlassFlow pipeline config reference](https://docs.glassflow.dev/configuration/pipeline-config-reference)
- [uccmisl/5Gdataset](https://github.com/uccmisl/5Gdataset)
- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
