# Running GlassFlow Demos with Altinity ClickHouse

This directory contains instructions for running the GlassFlow demos using Altinity ClickHouse as the destination database. The demos showcase two key features:
1. Deduplication of event streams
2. Enriching data through stream joins

## Prerequisites

- Altinity ClickHouse instance
- Python 3.8+
- Docker and Docker Compose installed
- Start GlassFlow and Kafka locally by running:
  ```bash
  docker compose up -d
  ```

## Configure GlassFlow

Before running any demo, you need to configure GlassFlow with your Altinity ClickHouse credentials. The configuration files are located in the [`config/glassflow/`](../../config/glassflow/) directory:

- [`deduplication_pipeline.json`](../../config/glassflow/deduplication_pipeline.json#L56) for the deduplication demo
- [`join_pipeline.json`](../../config/glassflow/join_pipeline.json#L102) for the join demo

In each file, update the following section with your Altinity ClickHouse credentials:

```json
{
    "sink": {
        "type": "clickhouse",
        "params": {
            "host": "your-altinity-host",
            "port": 8443,
            "username": "your-username",
            "password": "your-password",
            "database": "your-database",
            "secure": true
        }
    }
}
```

## Deduplication Demo

This demo shows how to handle duplicate events in your ClickHouse pipeline using GlassFlow.

### 1. Create Table in Altinity ClickHouse

Run the following SQL query in your Altinity ClickHouse instance:

```sql
CREATE TABLE IF NOT EXISTS user_events_deduplicated
(
    event_id UUID, 
    user_id UUID, 
    name String, 
    email String, 
    created_at DateTime
) 
ENGINE = ReplacingMergeTree
ORDER BY event_id
```

### 2. Run the Demo

Execute the deduplication demo with:

```bash
cd ../../
python demo_deduplication.py --config config/glassflow/deduplication_pipeline.json
```

## Join Demo

This demo demonstrates how to enrich order data with user information using stream joins.

### 1. Create Tables in Altinity ClickHouse

Run the following SQL queries in your Altinity ClickHouse instance to create the orders table with enriched users data:

```sql
CREATE TABLE IF NOT EXISTS orders_with_user_data 
(
    order_id UUID, 
    user_id UUID, 
    name String, 
    email String, 
    amount Int32
    price Float32, 
    created_at DateTime
) 
ENGINE = ReplacingMergeTree
ORDER BY order_id
```

### 2. Run the Demo

Execute the join demo with:

```bash
cd ../../
python demo_join.py --config config/glassflow/join_pipeline.json
```

## Notes

- Make sure your Altinity ClickHouse instance is accessible from your network
- The demos use secure connections (port 8443) by default
- Adjust the configuration parameters according to your Altinity ClickHouse setup
