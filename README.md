# GlassFlow ClickHouse ETL

GlassFlow ClickHouse ETL is an open-source streaming ETL tool designed to simplify data pipeline creation and management for ClickHouse. It provides a powerful, user-friendly interface for building and managing real-time data pipelines with built-in support for Kafka sources and ClickHouse sinks.

## Key Features

- **Streaming Deduplication**: 
  - Real-time deduplication of Kafka streams before ingestion into ClickHouse
  - Simple configuration of deduplication keys and time windows
  - One-click setup for deduplicated data pipelines
  - Prevents duplicate data from reaching ClickHouse

- **Temporal Stream Joins**:
  - Join two Kafka streams in real-time
  - Configure join keys and time windows through the UI
  - Simplified join setup process
  - Produce joined streams ready for ClickHouse ingestion

- **Optimized ClickHouse Sink**:
  - Configurable batch sizes for efficient data ingestion
  - Adjustable wait times for optimal throughput
  - Built-in retry mechanisms
  - Automatic schema detection and management

- **User-Friendly Interface**: Web-based UI for pipeline configuration and management
- **Local Development**: Includes demo setup with local Kafka and ClickHouse instances
- **Docker Support**: Easy deployment using Docker and docker-compose
- **Self-Hosted**: Open-source solution that can be self-hosted in your infrastructure

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/glassflow/clickhouse-etl.git
cd clickhouse-etl
```

2. Start the services using Docker Compose:
```bash
docker-compose up -d
```

3. Access the web interface at `http://localhost:8080` to configure your pipeline:
  - **Connection Setup**:
     - Configure Kafka source connection parameters
     - Configure ClickHouse sink connection parameters
  - **Pipeline Configuration**:
     - Select Kafka input streams
     - Define deduplication key and time window
     - For joins: specify join keys and time window for each stream
     - Configure ClickHouse table settings
  - **Pipeline Management**:
     - Start/stop pipelines
     - Check pipeline logs

## Usage

### Creating a Pipeline

1. Access the web interface at `http://localhost:8080`
2. Configure your source (Kafka) and sink (ClickHouse) connections
3. Define your pipeline transformations:
   - Set up deduplication rules
   - Configure temporal joins between streams
   - Define data transformations
4. Start the pipeline and monitor its progress

### Local Testing

The project includes a comprehensive demo setup in the `demos` folder that provides a complete local testing environment. This setup includes:

- Local Kafka instance with Zookeeper
- Local ClickHouse instance
- Sample data generation using [glassgen](https://pypi.org/project/glassgen/)
- Example pipeline configurations
- Step-by-step instructions for running the demo

For detailed instructions on setting up and running the local testing environment, see the [demos/README.md](demos/README.md).

## Architecture

The project consists of several key components:

- **GlassFlow API**: Core ETL engine written in Go
- **Web UI**: User interface for pipeline management
- **NATS**: Message broker for internal communication
- **Kafka Bridge**: Connector for Kafka integration using the [NATS-Kafka Bridge](https://github.com/nats-io/nats-kafka)

For information about third-party components and their licenses, please see our [NOTICE](NOTICE) file.


## Pipeline Configuration

The pipeline configuration is defined in a JSON file that specifies the source, sink, and any transformations. While the web interface automatically generates this configuration, understanding its structure can be helpful for advanced users.

### Configuration Structure

```json
{
    "pipeline_id": "unique-pipeline-id",
    "source": {
      "type": "kafka",
      "provider": "kafka-provider",
      "connection_params": {
        "brokers": ["kafka-broker:port"],
        "protocol": "SASL_SSL",
        "mechanism": "SCRAM-SHA-256",
        "username": "kafka-username",
        "password": "kafka-password",
        "root_ca": "SSL-certificate"
      },
      "topics": [
        {
          "name": "topic-name",
          "consumer_group_initial_offset": "latest",
          "schema": {
            "type": "json",
            "fields": [
              {
                "name": "field-name",
                "type": "field-type"
              }
            ]
          },
          "deduplication": {
            "enabled": true,
            "id_field": "unique-id-field",
            "id_field_type": "string",
            "time_window": "12h"
          }
        }
      ]
    },
    "sink": {
      "type": "clickhouse",
      "provider": "clickhouse-provider",
      "host": "clickhouse-host",
      "port": "clickhouse-port",
      "database": "database-name",
      "username": "clickhouse-username",
      "password": "clickhouse-password",
      "secure": true,
      "max_batch_size": 1000,
      "max_delay_time": "30s",
      "table": "table-name",
      "table_mapping": [
        {
          "source_id": "source-topic",
          "field_name": "source-field",
          "column_name": "target-column",
          "column_type": "column-type"
        }
      ]
    },
    "join": {
      "enabled": false
    }
}
```

### Configuration Sections

#### Source Configuration
- **pipeline_id**: Unique identifier for the pipeline
- **source**: Kafka source configuration
  - **type**: Always "kafka"
  - **provider**: Kafka provider (e.g., "aiven")
  - **connection_params**: Kafka connection details
    - **brokers**: List of Kafka broker addresses
    - **protocol**: Security protocol (e.g., "SASL_SSL")
    - **mechanism**: Authentication mechanism
    - **username/password**: Authentication credentials
    - **root_ca**: SSL certificate
  - **topics**: List of Kafka topics to consume
    - **name**: Topic name
    - **consumer_group_initial_offset**: Starting offset ("latest" or "earliest")
    - **schema**: Topic message schema
    - **deduplication**: Deduplication settings
      - **enabled**: Enable/disable deduplication
      - **id_field**: Field to use for deduplication
      - **id_field_type**: Type of the ID field
      - **time_window**: Time window for deduplication (e.g., "12h")

#### Sink Configuration
- **sink**: ClickHouse sink configuration
  - **type**: Always "clickhouse"
  - **provider**: ClickHouse provider
  - **host/port**: ClickHouse server details
  - **database**: Target database
  - **username/password**: Authentication credentials
  - **secure**: Enable SSL
  - **max_batch_size**: Maximum number of records per batch
  - **max_delay_time**: Maximum delay before flushing a batch
  - **table**: Target table name
  - **table_mapping**: Field-to-column mappings
    - **source_id**: Source topic ID
    - **field_name**: Source field name
    - **column_name**: Target column name
    - **column_type**: Target column type

#### Join Configuration
- **join**: Join configuration (optional)
  - **enabled**: Enable/disable stream joining (true/false)
  - **type**: Type of join (currently only supports "temporal")
  - **sources**: List of sources to join
    - **source_id**: Identifier of the source topic
    - **join_key**: Field to use for joining
    - **time_window**: Time window for the join (e.g., "1h")
    - **orientation**: Join orientation ("left" or "right")

Example join configuration:
```json
"join": {
  "enabled": true,
  "type": "temporal",
  "sources": [
    {
      "source_id": "left-topic",
      "join_key": "user_id",
      "time_window": "1h",
      "orientation": "left"
    },
    {
      "source_id": "right-topic",
      "join_key": "username",
      "time_window": "1h",
      "orientation": "right"
    }
  ]
}
```

Note: The web interface automatically generates this configuration based on user input, so manual editing is not required.


## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the [Apache License 2.0](LICENSE).

## Support

For support, please:
- Open an issue in the GitHub repository
- Join our [Slack community](https://join.slack.com/t/glassflowhub/shared_invite/zt-2g3s6nhci-bb8cXP9g9jAQ942gHP5tqg)
- Email us at [help@glassflow.dev](mailto:help@glassflow.dev)
