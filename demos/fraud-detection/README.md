# Fraud Detection Demo with GlassFlow and ClickHouse

Kubernetes-based fraud detection pipeline: Kafka → GlassFlow (filter + dedup) → ClickHouse

This demo shows how to use GlassFlow to build a real-time fraud detection pipeline for login events. GlassFlow filters out successful logins (keeping only failures) and deduplicates retry events before writing clean data to ClickHouse, where SQL window queries surface brute-force and credential-stuffing patterns.

## Requirements

- `kubectl` configured to connect to your cluster
- `helm` (v3.x)
- `kind` (Kubernetes in Docker) — for local cluster setup
- A running Kubernetes cluster (or use kind to create one) with:
  - **Minimum**: 4 CPU cores, 8 GB RAM
- Python 3.10+

## Quick Start

```bash
# 0. Create a kind cluster (if you don't have one)
kind create cluster --name demo

# 1. Install the stack (Kafka, ClickHouse, GlassFlow)
make install-stack

# 2. Port-forward the GlassFlow API
make pf-glassflow-api   # runs in foreground — open a second terminal for the next steps

# 3. Run the demo (creates table, pipeline, publishes events)
make deploy-demo

# 4. Query for fraud signals
make query-fraud

# 5. Tear down
make delete-stack
kind delete cluster --name demo
```

Or follow the steps below individually.

## Step-by-step

### 1. Install the stack

```bash
make install-stack
```

This adds the Bitnami and GlassFlow Helm repos, creates namespaces, installs Kafka (no auth), ClickHouse, and GlassFlow, then waits for each component to become ready.

### 2. Port-forward the GlassFlow API

The GlassFlow API is a ClusterIP service. Port-forward it before running any pipeline commands:

```bash
make pf-glassflow-api   # http://localhost:8081
```

Optionally, open the GlassFlow UI in a separate terminal:

```bash
make pf-glassflow-ui    # http://localhost:8080
```

### 3. Create the ClickHouse table

```bash
make create-table
```

### 4. Create the GlassFlow pipeline

```bash
make create-pipeline
```

This uses the Python SDK to POST `glassflow/fraud_detection_pipeline.json` to the GlassFlow API.

### 5. Publish login events

Use the pre-built sample dataset or regenerate it:

```bash
# Regenerate (optional — data/login-events.ndjson is already included)
make generate-events

# Publish to Kafka
make publish-events
```

### 6. Run fraud detection queries

```bash
make query-burst    # 30-second burst detection
make query-fraud    # 5-minute brute-force window (main demo query)
make query-hourly   # 1-hour distributed attack view
```

### 7. Tear down

Remove only the demo (table + pipeline), keeping the stack running:

```bash
make delete-demo
```

Remove everything:

```bash
make delete-stack
```

## Architecture

```
LoginEventGenerator → Kafka (login-attempts) → GlassFlow → ClickHouse ← SQL Fraud Queries
                                                    │
                                              filter: drop success events
                                              dedup:  drop retry duplicates (1h window)
```

## Configuration

- **Helm Values**: `k8s/helm-values/` — Kafka (no auth), ClickHouse, GlassFlow configs
- **GlassFlow Pipeline**: `glassflow/fraud_detection_pipeline.json` — Kafka source, filter, deduplication, ClickHouse sink
- **SQL Queries**: `sql/fraud_detection_queries.sql` — table DDL and three fraud detection windows
- **Event Generator**: `scripts/generate_login_events.py` — deterministic NDJSON generator (seed-based)
- **Sample Dataset**: `data/login-events.ndjson` — pre-generated dataset (40 events, 6 duplicates, burst pattern)

## Notes

- The sample dataset is deterministic. Re-running the generator with the same `--seed` produces identical events.
- GlassFlow filters define what to **drop**. The pipeline uses `status != 'failed'` to keep only failed logins.
- Deduplication uses `event_id` with a 1-hour time window to absorb client retries.

## References

- [Pipeline Configuration Reference](https://docs.glassflow.dev/configuration/pipeline-json-reference)
- [GlassFlow Python SDK](https://github.com/glassflow/glassflow-python-sdk)
- [ClickHouse Documentation](https://clickhouse.com/docs/en/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
