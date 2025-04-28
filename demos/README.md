# GlassFlow ClickHouse ETL Demo

This demo showcases the capabilities of GlassFlow ClickHouse ETL using a local development environment. The demo includes:

- Local Kafka and ClickHouse instances
- Event generation with configurable parameters
- Pipeline setup for deduplication and joins
- Real-time data processing demonstration

## Prerequisites

- Docker and Docker Compose
- Python 3.8+
- pip (Python package manager)

## Setup

1. Create and activate a virtual environment:
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# .\venv\Scripts\activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Start the local infrastructure:
```bash
docker compose up -d
```
This will start:
- Zookeeper (port 2181)
- Kafka (ports 9092, 9093, 9094)
- ClickHouse (ports 8123, 9000)
- GlassFlow ClickHouse ETL application (port 8080)

The GlassFlow web interface will be available at http://localhost:8080 where you can monitor and manage your pipelines.

## Running the Demos

### Deduplication Demo

The deduplication demo can be run with default parameters or customized using command-line arguments:

```bash
python demo_deduplication.py [options]
```

#### Command Line Options

- `--num-records`: Number of records to generate (default: 10000)
- `--duplication-rate`: Rate of duplication (default: 0.1)
- `--rps`: Records per second (default: 1000)
- `--config`: Path to pipeline configuration file (default: config/glassflow/deduplication_pipeline.json)
- `--generator-schema`: Path to generator schema file (default: config/glassgen/user_event.json)
- `--yes` or `-y`: Skip confirmation prompts
- `--cleanup` or `-c`: Cleanup ClickHouse table before running the pipeline

#### Example Usage

1. Run with default parameters:
```bash
python demo_deduplication.py
```

2. Generate 5000 records with 5% duplication rate:
```bash
python demo_deduplication.py --num-records 5000 --duplication-rate 0.05
```

3. Run with custom configuration and cleanup:
```bash
python demo_deduplication.py --config custom_config.json --cleanup
```

### Join Demo

The join demo demonstrates how to join data from two different Kafka topics using GlassFlow's temporal join capabilities. It can be run with default parameters or customized using command-line arguments:

```bash
python demo_join.py [options]
```

#### Command Line Options

- `--left-num-records`: Number of records to generate for left events (default: 10000)
- `--right-num-records`: Number of records to generate for right events (default: 10000)
- `--rps`: Records per second (default: 1000)
- `--config`: Path to pipeline configuration file (default: config/glassflow/join_pipeline.json)
- `--left-schema`: Path to left events generator schema file (default: config/glassgen/order_event.json)
- `--right-schema`: Path to right events generator schema file (default: config/glassgen/user_event.json)
- `--yes` or `-y`: Skip confirmation prompts
- `--cleanup` or `-c`: Cleanup ClickHouse table before running the pipeline

#### Example Usage

1. Run with default parameters:
```bash
python demo_join.py
```

2. Generate 5000 left events and 3000 right events:
```bash
python demo_join.py --left-num-records 5000 --right-num-records 3000
```

3. Run with custom configuration and cleanup:
```bash
python demo_join.py --config custom_config.json --cleanup
```

## What the Demos Do

### Deduplication Demo

1. **Infrastructure Setup**:
   - Creates necessary Kafka topics
   - Sets up ClickHouse table
   - Configures the GlassFlow pipeline using [`glassflow-clickhouse-etl`](https://pypi.org/project/glassflow-clickhouse-etl/) Python SDK

2. **Event Generation**:
   - Uses [`glassgen`](https://pypi.org/project/glassgen/) Python library to generate synthetic events
   - Generates events with configurable duplication rate
   - Sends events to Kafka at specified rate (RPS)
   - Includes unique IDs and timestamps
   - Supports various data types and generators (names, emails, UUIDs, etc.)

3. **Deduplication Process**:
   - GlassFlow processes the events
   - Removes duplicates based on configured time window
   - Writes deduplicated data to ClickHouse

4. **Results**:
   - Shows number of generated events
   - Displays number of duplicates
   - Reports final number of records in ClickHouse

### Join Demo

1. **Infrastructure Setup**:
   - Creates necessary Kafka topics for both left and right events
   - Sets up ClickHouse table for joined results
   - Configures the GlassFlow pipeline using [`glassflow-clickhouse-etl`](https://pypi.org/project/glassflow-clickhouse-etl/) Python SDK

2. **Event Generation**:
   - Uses [`glassgen`](https://pypi.org/project/glassgen/) Python library to generate synthetic events (left and right) with matching join keys
   - Uses different schemas for each event type:
     - Left events (orders): order_id, user_id, amount, price, created_at
     - Right events (users): event_id, user_id, name, email, created_at
   - Sends events to their respective Kafka topics at specified rate (RPS)

3. **Join Process**:
   - GlassFlow performs temporal joins between the two event streams
   - Matches events based on the join key (user_id)
   - Joins events within the configured time window
   - Writes joined results to ClickHouse

4. **Results**:
   - Shows number of generated events for both streams
   - Displays sample joined records
   - Reports final number of records in ClickHouse

## Configuration Files

The demos use several configuration files:

1. **Pipeline Configurations**:
   - **Deduplication Pipeline** [`config/glassflow/deduplication_pipeline.json`](config/glassflow/deduplication_pipeline.json):
     This file defines the GlassFlow ETL pipeline that processes and deduplicates events.

   - **Join Pipeline** [`config/glassflow/join_pipeline.json`](config/glassflow/join_pipeline.json):
     This file defines the GlassFlow ETL pipeline that performs temporal joins between two event streams.

   Both pipeline configurations contain:
   - **Source Configuration**:
     - Kafka connection details (brokers, security settings)
     - Topic configuration
     - Schema definition for events
     - Deduplication settings (time window, ID field)

   - **Sink Configuration**:
     - ClickHouse connection details
     - Table mapping
     - Batch processing settings

   To customize the pipelines, you can modify these files:
   - Change Kafka broker addresses if using external Kafka
   - Update ClickHouse connection details for external ClickHouse
   - Modify time windows and processing parameters

2. **Generator Schemas**:
   - **User Events** [`config/glassgen/user_event.json`](config/glassgen/user_event.json):
     This file defines the structure of user events using glassgen's generator syntax.

   - **Order Events** [`config/glassgen/order_event.json`](config/glassgen/order_event.json):
     This file defines the structure of order events using glassgen's generator syntax.

   The format is a JSON object where:
   - Keys are the field names in the generated events
   - Values are the generator types (prefixed with `$`)

   Example schemas:
   ```json
   // User events
   {
     "event_id": "$uuid4",
     "user_id": "$uuid4",
     "name": "$name",
     "email": "$email",
     "created_at": "$datetime"
   }

   // Order events
   {
     "order_id": "$uuid4",
     "user_id": "$uuid4",
     "amount": "$intrange(1,15)",
     "price": "$price(1,250)",
     "created_at": "$datetime"
   }
   ```
   Complete list of supported generators can be found at [glassgen's documentation](https://github.com/glassflow/glassgen?tab=readme-ov-file#supported-schema-generators)

## Troubleshooting

1. **Infrastructure Issues**:
   - If services fail to start, check Docker logs:
     ```bash
     docker compose logs
     ```

2. **Pipeline Creation Issues**:
   - Ensure GlassFlow is running:
     ```bash
     docker compose up
     ```
   - Check pipeline status in the web interface (http://localhost:8080)

3. **Data Generation Issues**:
   - Verify Kafka topics are created:
     ```bash
     docker compose exec kafka kafka-topics --list --bootstrap-server localhost:9093 --command-config /etc/kafka/client.properties
     ```
   - Check ClickHouse table:
     ```bash
     docker compose exec clickhouse clickhouse-client --user default --password secret --query "SELECT count() FROM <table_name>"
     ```

## Cleanup

To stop and remove all containers:
```bash
docker compose down
```

To remove all data (including volumes):
```bash
docker compose down -v
```

## Additional Resources

- [GlassGen Documentation](https://github.com/glassflow/glassgen)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [ClickHouse Documentation](https://clickhouse.com/docs/en/) 