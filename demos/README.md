# GlassFlow ClickHouse ETL Demo

This demo showcases the deduplication capabilities of GlassFlow ClickHouse ETL using a local development environment. The demo includes:

- Local Kafka and ClickHouse instances
- Event generation with configurable duplication rates
- Deduplication pipeline setup
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

## Running the Demo

The demo can be run with default parameters or customized using command-line arguments:

```bash
python demo_deduplication.py [options]
```

### Command Line Options

- `--num-records`: Number of records to generate (default: 10000)
- `--duplication-rate`: Rate of duplication (default: 0.1)
- `--rps`: Records per second (default: 1000)
- `--config`: Path to pipeline configuration file (default: config/glassflow/deduplication_pipeline.json)
- `--generator-schema`: Path to generator schema file (default: config/glassgen/user_event.json)
- `--yes` or `-y`: Skip confirmation prompts
- `--cleanup` or `-c`: Cleanup ClickHouse table before running the pipeline

### Example Usage

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

## What the Demo Does

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

## Configuration Files

The demo uses two main configuration files:

1. **Pipeline Configuration** [`config/glassflow/deduplication_pipeline.json`](config/glassflow/deduplication_pipeline.json):
   This file defines the GlassFlow ETL pipeline that processes and deduplicates events. It contains:

   - **Source Configuration**:
     - Kafka connection details (brokers, security settings)
     - Topic configuration
     - Schema definition for events
     - Deduplication settings (time window, ID field)

   - **Sink Configuration**:
     - ClickHouse connection details
     - Table mapping
     - Batch processing settings

   To customize the pipeline, you can modify this file:
   - Change Kafka broker addresses if using external Kafka
   - Update ClickHouse connection details for external ClickHouse
   - Modify deduplication time window
   - Adjust batch processing parameters

   Example customization:
   ```json
   {
     "source": {
       "connection_params": {
         "brokers": ["external-kafka:9092"]
       }
     },
     "sink": {
       "host": "external-clickhouse",
       "port": "9000"
     }
   }
   ```

2. **Generator Schema** [`config/glassgen/user_event.json`](config/glassgen/user_event.json):
   This file defines the structure of synthetic events using glassgen's generator syntax. The format is a JSON object where:
   - Keys are the field names in the generated events
   - Values are the generator types (prefixed with `$`)

   Example schema:
   ```json
   {
     "event_id": "$uuid4",
     "user_id": "$uuid4",
     "name": "$name",
     "email": "$email",
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
     docker compose exec clickhouse clickhouse-client--user default --password secret --query "SELECT count() FROM <table_name>"
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