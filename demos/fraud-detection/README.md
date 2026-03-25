# Fraud Detection Demo with GlassFlow and ClickHouse

Kubernetes-based fraud detection pipeline: Kafka → GlassFlow (filter + dedup) → ClickHouse

This demo shows how to use GlassFlow to build a real-time fraud detection pipeline for login events. GlassFlow filters out successful logins (keeping only failures) and deduplicates retry events before writing clean data to ClickHouse, where SQL window queries surface brute-force and credential-stuffing patterns.

## Requirements

- `kubectl` configured to connect to your cluster
- A running Kubernetes cluster with Kafka and ClickHouse already deployed
  - **Minimum**: 2 CPU cores, 4 GB RAM
- [GlassFlow](https://docs.glassflow.dev) deployed on the cluster
- Python 3.10+

## Quick Start

### 1. Create the ClickHouse table

```bash
kubectl exec -n clickhouse svc/clickhouse -- clickhouse-client \
  --user default \
  --password glassflow-demo-password \
  --query "$(cat sql/fraud_detection_queries.sql | head -13)"
```

Or run the full SQL file directly:

```bash
kubectl exec -i -n clickhouse svc/clickhouse -- clickhouse-client \
  --user default \
  --password glassflow-demo-password \
  < sql/fraud_detection_queries.sql
```

### 2. Create the GlassFlow pipeline

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/python - <<'PY'
from glassflow.etl import Client

client = Client(host="http://localhost:30180")
pipeline = client.create_pipeline(
    pipeline_config_json_path="glassflow/fraud_detection_pipeline.json"
)
print(pipeline.pipeline_id, pipeline.status)
PY
```

### 3. Generate and publish login events

Generate a deterministic sample dataset (or use the pre-built one in `data/`):

```bash
python3 scripts/generate_login_events.py --output data/login-events.ndjson
```

Publish to Kafka:

```bash
chmod +x scripts/publish_to_kafka.sh
./scripts/publish_to_kafka.sh data/login-events.ndjson
```

### 4. Run fraud detection queries

**5-minute brute-force window** (main tutorial query):

```bash
kubectl exec -n clickhouse svc/clickhouse -- clickhouse-client \
  --user default \
  --password glassflow-demo-password \
  --query "
SELECT
    toStartOfInterval(event_time, INTERVAL 5 MINUTE) AS window_start,
    user_id,
    ip_address,
    count() AS failed_attempts,
    uniqExact(device_id) AS distinct_devices
FROM fraud_login_events
GROUP BY window_start, user_id, ip_address
HAVING failed_attempts >= 5
ORDER BY window_start DESC, failed_attempts DESC
FORMAT Vertical"
```

Additional queries (30-second burst detection, 1-hour distributed attack view) are in [`sql/fraud_detection_queries.sql`](sql/fraud_detection_queries.sql).

## Architecture

```
LoginEventGenerator → Kafka (login-attempts) → GlassFlow → ClickHouse ← SQL Fraud Queries
                                                    │
                                              filter: drop success events
                                              dedup:  drop retry duplicates (1h window)
```

## Configuration

- **GlassFlow Pipeline**: [`glassflow/fraud_detection_pipeline.json`](glassflow/fraud_detection_pipeline.json) — Kafka source, filter, deduplication, ClickHouse sink
- **SQL Queries**: [`sql/fraud_detection_queries.sql`](sql/fraud_detection_queries.sql) — table DDL and three fraud detection windows
- **Event Generator**: [`scripts/generate_login_events.py`](scripts/generate_login_events.py) — deterministic NDJSON generator (seed-based)
- **Sample Dataset**: [`data/login-events.ndjson`](data/login-events.ndjson) — pre-generated dataset (40 events, 6 duplicates, burst pattern)

## Notes

- The sample dataset is deterministic. Re-running the generator with the same `--seed` produces identical events.
- GlassFlow filters define what to **drop**. The pipeline uses `status != 'failed'` to keep only failed logins.
- Deduplication uses `event_id` with a 1-hour time window to absorb client retries.

## References

- [Pipeline Configuration Reference](https://docs.glassflow.dev/configuration/pipeline-json-reference)
- [GlassFlow Python SDK](https://github.com/glassflow/glassflow-python-sdk)
- [ClickHouse Documentation](https://clickhouse.com/docs/en/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
