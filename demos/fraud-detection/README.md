# Fraud Detection Demo

Detect brute-force login attacks using Kafka, GlassFlow, and ClickHouse.

GlassFlow sits between Kafka and ClickHouse: it filters out successful logins, deduplicates retried events by `event_id` (1 h window), and delivers only unique failed logins to ClickHouse. Fraud queries then run directly on clean data.

## Prerequisites

- [GlassFlow CLI](https://docs.glassflow.dev/installation/cli) installed
- Docker running
- Python 3.10+

## Quick Start

### 1. Start the local environment

```bash
glassflow up --demo
```

### 2. Configure credentials

All credentials in `.env` are base64-encoded. The defaults match `glassflow up --demo`.

```bash
cp .env.example .env
# To encode your own values: echo -n 'my-password' | base64
```

### 3. Create the Kafka topic and ClickHouse table

```bash
./scripts/create_topic.sh
./scripts/create_table.sh
```

### 4. Create the GlassFlow pipeline

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/create_pipeline.py
```

### 5. Generate and publish sample events

```bash
python3 scripts/generate_login_events.py \
  --count 40 --duplicates 6 --seed 7 \
  --output data/login-events.ndjson

./scripts/publish_to_kafka.sh data/login-events.ndjson
```

The dataset contains ~21 successful logins, ~19 unique failed logins, and 6 duplicate retries.

### 6. Query for suspicious activity

Wait ~15 seconds for GlassFlow to flush, then:

```bash
./scripts/run_fraud_queries.sh
```

### 7. Clean up

```bash
glassflow down
```

## Files

| Path | Purpose |
|------|---------|
| `scripts/generate_login_events.py` | Deterministic login event generator |
| `scripts/publish_to_kafka.sh` | Publishes NDJSON events to Kafka via `kubectl exec` |
| `scripts/create_topic.sh` | Creates the `login-attempts` Kafka topic |
| `scripts/create_table.sh` | Creates the `fraud_login_events` ClickHouse table |
| `scripts/create_pipeline.py` | Creates the GlassFlow pipeline via the Python SDK |
| `scripts/run_fraud_queries.sh` | Runs the 5-minute fraud detection query |
| `glassflow/fraud_detection_pipeline.json` | GlassFlow pipeline config (filter + dedup + sink) |
| `sql/fraud_detection_queries.sql` | ClickHouse DDL and fraud detection queries (30 s, 5 min, 1 h) |
| `data/login-events.ndjson` | Pre-generated sample dataset |

## Resources

- [GlassFlow Documentation](https://docs.glassflow.dev/)
- [Blog: Fraud Detection with Kafka, GlassFlow, and ClickHouse](https://glassflow.dev/blog/fraud-detection)
