# Running GlassFlow Demos with Altinity ClickHouse

This directory contains instructions for running the GlassFlow demos using Altinity ClickHouse as the destination database. The demo showcases three key features:
1. Demonstrating the duplicate events problem in ClickHouse
2. Solving the problem using GlassFlow's deduplication capabilities
3. Enriching data through stream joins

## Prerequisites

- Altinity ClickHouse instance
- Python 3.8+
- Docker and Docker Compose installed
- Start GlassFlow and Kafka locally by running:
  ```bash
  docker compose up -d
  ```
- Create and activate a Python virtual environment:
  ```bash
  # Create virtual environment
  python -m venv .venv

  # Activate virtual environment
  # On macOS/Linux:
  source .venv/bin/activate
  # On Windows:
  # .\venv\Scripts\activate
  ```
- Install Python dependencies:
  ```bash
  pip install -r requirements.txt
  ```

## Required Tables in Altinity ClickHouse

Before running the demo, you need to create the following tables in your Altinity ClickHouse instance:

```sql
-- Table for Part 1: Demonstrating the problem
CREATE TABLE IF NOT EXISTS orders 
(
    order_id UUID, 
    user_id UUID, 
    product_id UUID, 
    quantity Int32, 
    price Float64, 
    created_at DateTime
) 
ENGINE = ReplacingMergeTree
ORDER BY order_id;

-- Table for Part 2: GlassFlow deduplication
CREATE TABLE IF NOT EXISTS orders_glassflow 
(
    order_id UUID, 
    user_id UUID, 
    product_id UUID, 
    price Float64, 
    quantity Int32, 
    created_at DateTime
) 
ENGINE = ReplacingMergeTree
ORDER BY order_id;

-- Table for Part 3: Enriched data with joins
CREATE TABLE IF NOT EXISTS orders_enriched 
(
    order_id UUID, 
    user_id UUID, 
    product_id UUID, 
    price Float64, 
    quantity Int32, 
    user_name String, 
    user_email String, 
    user_phone_number String, 
    user_address String, 
    user_city String, 
    user_zipcode String, 
    user_country String, 
    created_at DateTime
) 
ENGINE = ReplacingMergeTree
ORDER BY order_id;
```

## Configure ClickHouse Credentials

Before running the demo, you need to update the ClickHouse credentials in the demo script. Open [`demo.py`](demo.py) and update the following section with your Altinity ClickHouse credentials:

```python
def create_clickhouse_client():
    """Initialize ClickHouse client"""
    return get_client(
        host="<your-clickhouse-host>",
        username="<your-clickhouse-username>",
        password="<your-clickhouse-password>",
        database="<your-clickhouse-database>",
        port=8443,  # default port for Altinity ClickHouse
    )
```

## Running the Demo

The demo script will guide you through three parts:

### Part 1: Demonstrating the Problem

The script will:
1. Generate and insert events with duplicates into the `orders` table
2. Show you how ClickHouse's ReplacingMergeTree engine alone cannot fully handle duplicates

### Part 2: Solution with GlassFlow

The script will:
1. Create a Kafka topic for the events
2. Prompt you to create a pipeline in the GlassFlow UI (http://localhost:8080)
3. Generate events with duplicates and send them to Kafka
4. Show you how GlassFlow successfully deduplicates the events into the `orders_glassflow` table

### Part 3: Enriching Data with Joins

The script will:
1. Create Kafka topics for orders and users
2. Prompt you to create a join pipeline in the GlassFlow UI
3. Generate matching events for both topics
4. Show you how to check the enriched data in the `orders_enriched` table

To run the demo:

```bash
python demo.py
```

## Notes

- Make sure your Altinity ClickHouse instance is accessible from your network
- The demo uses secure connections (port 8443) by default
- Adjust the configuration parameters according to your Altinity ClickHouse setup
- Monitor the GlassFlow UI (http://localhost:8080) to visualize the data flow and transformations
