<a href="https://glassflow.dev">
  <img alt="GlassFlow Logo" src="https://raw.githubusercontent.com/glassflow/clickhouse-etl/main/docs/public/assets/glassfow-banner.jpg">
</a>

<p align="center">
      <a href="https://docs.glassflow.dev"><strong>Docs</strong></a> ·     
      <a href="https://github.com/glassflow/clickhouse-etl/issues"><strong>Report Bug</strong></a> ·
      <a href="https://glassflow.dev/roadmap"><strong>Roadmap</strong></a> ·
      <a href="https://github.com/orgs/glassflow/discussions/categories/support"><strong>Get Help</strong></a> ·
      <a href="https://docs.glassflow.dev/demo"><strong>Watch Demo</strong></a>
</p>

<div align="center">

[![Join Next Office Hour](https://img.shields.io/badge/Join%20Next%20Office%20Hour-Schedule%20Now-blue?logo=calendar)](https://www.glassflow.dev/office-hours)
[![Email Support](https://img.shields.io/badge/Email%20Support-help%40glassflow.dev-blue?logo=gmail)](mailto:help@glassflow.dev)
<br>
[![Slack](https://img.shields.io/badge/Join%20Slack-GlassFlow%20Hub-blueviolet?logo=slack)](https://join.slack.com/t/glassflowhub/shared_invite/zt-349m7lenp-IFeKSGfQwpJfIiQ7oyFFKg)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/glassflowdev.svg?style=social&label=Follow%20%40GlassFlow)](https://twitter.com/glassflowdev)
</div>
<div align="center">
  <a href="https://github.com/glassflow/clickhouse-etl/releases">
    <img alt="Latest Release" src="https://img.shields.io/github/v/release/glassflow/clickhouse-etl?label=Latest%20Version">
  </a>
</div>

# GlassFlow for ClickHouse Streaming ETL

GlassFlow is an open-source streaming ETL that enables real-time data processing from Kafka to ClickHouse with features like deduplication and temporal joins. ClickHouse users can clean and ingest high-frequency data streams without using RMT or FINAL at ClickHouse.

## ⚡️ Run a local demo
This guide walks you through a **local installation using Docker Compose** using the GlassFlow UI. It spins up a local Kafka, GlassFlow and a local ClickHouse. It showcases how deduplication works at GlassFlow. It is perfect for development, testing, or trying out GlassFlow on your machine.

1. Clone the repository:
```bash
git clone https://github.com/glassflow/clickhouse-etl.git
cd clickhouse-etl
```


2. Navigate to the demo directory:
```bash
cd demos
```


3. Start the local infrastructure:
```bash
docker compose up -d
```
This will start the following services:
- Kafka (ports 9092 - external, 9093 - internal)
- ClickHouse (ports 8123 - HTTP, 9000 - Native)
- GlassFlow ClickHouse ETL application (port 8080)


4. Create Kafka Topics:
```bash
# Create a new Kafka topic
docker compose exec kafka kafka-topics \
    --topic users \
    --create \
    --partitions 1 \
    --replication-factor 1 \
    --bootstrap-server localhost:9092
```


5. Create ClickHouse Table:
```bash
docker compose exec clickhouse clickhouse-client \
    --user default \
    --password secret \
    --query "
CREATE TABLE IF NOT EXISTS users_dedup (
    event_id UUID,
    user_id UUID,
    name String,
    email String,
    created_at DateTime,
    tags Array(String)
) ENGINE = MergeTree 
ORDER BY event_id"
```


6. Generate a test event in Kafka to help you create the pipeline in the UI
```bash
# Send multiple JSON events to Kafka
echo '{"event_id": "49a6fdd6f305428881f3436eb498fc9d", "user": {"id": "8db09a6aa33a46f6bdabe4683a34ac4d", "name": "John Doe", "email": "john@example.com"}, "created_at": "2024-03-20T10:00:00Z", "tags": ["tag1", "tag222"]}' |
docker compose exec -T kafka kafka-console-producer \
    --topic users \
    --bootstrap-server localhost:9092
```


7. Configure Pipeline in UI

Access the GlassFlow UI at http://localhost:8080 and use these connection details to create a deduplication pipeline:

  Kafka Connection
```bash
Authentication Method: No Authentication
Security Protocol: PLAINTEXT
Bootstrap Servers: kafka:9093
```
  Kafka Topic
```bash
Topic Name: users
Consumer Group Initial Offset: latest
Schema:
{
  "event_id": "49a6fdd6f305428881f3436eb498fc9d",
  "user": {
    "id": "8db09a6aa33a46f6bdabe4683a34ac4d",
    "name": "Jane Smith",
    "email": "jane@example.com"
  },
  "created_at": "2024-03-20T10:03:00Z",
  "tags": ["tag13", "tag324"]
}
```

  Deduplication
```bash
Enabled: true
Deduplicate Key: event_id
Deduplicate Key Type: string
Time Window: 1h
```

  ClickHouse Connection
```bash
Host: clickhouse
HTTP/S Port: 8123
Native Port: 9000
Username: default
Password: secret
Use SSL: false
```

  ClickHouse Table
```bash
Table: users_dedup
```

  Send data to Kafka
```bash
# Send multiple JSON events to Kafka
echo '{"event_id": "49a6fdd6f305428881f3436eb498fc9d", "user": {"id": "8db09a6aa33a46f6bdabe4683a34ac4d", "name": "John Doe", "email": "john@example.com"}, "created_at": "2024-03-20T10:00:00Z", "tags": ["tag1", "tag222"]}
{"event_id": "49a6fdd6f305428881f3436eb498fc9d", "user": {"id": "8db09a6aa33a46f6bdabe4683a34ac4d", "name": "John Doe", "email": "john@example.com"}, "created_at": "2024-03-20T10:01:00Z", "tags": ["tag1", "tag222"]}
{"event_id": "f0ed455046a543459d9a51502cdc756d", "user": {"id": "a7f93b87e29c4978848731e204e47e97", "name": "Jane Smith", "email": "jane@example.com"}, "created_at": "2024-03-20T10:03:00Z", "tags": ["tag13", "tag324"]}' |
docker compose exec -T kafka kafka-console-producer \
    --topic users \
    --bootstrap-server localhost:9092
```

Verify Results
After a few seconds (maximum delay time - default 1 minute), you should see the deduplicated events in ClickHouse:
```bash
docker compose exec clickhouse clickhouse-client \
    --user default \
    --password secret \
     -f prettycompact \
    --query "SELECT * FROM users_dedup"
```

```bash
   ┌─event_id─┬─user_id─┬─name───────┬─email────────────┬──────────created_at─┬─tags────────────────┐
1. │      123 │     456 │ John Doe   │ john@example.com │ 2024-03-20 10:00:00 │ ["tag1", "tag222"]  │
2. │      124 │     457 │ Jane Smith │ jane@example.com │ 2024-03-20 10:03:00 │ ["tag13", "tag324"] │
   └──────────┴─────────┴────────────┴──────────────────┴─────────────────────┴─────────────────────┘
```
To start creating your own pipelines with the UI, you can follow the pipeline/usage/web-ui guide.

## 🧭 Installation Options

GlassFlow is open source and can be self-hosted on Kubernetes. GlassFlow works with any managed Kubernetes services like AWS EKS, GKE, AKS, and more.
For local testing or a small POC, you can also use Docker and Docker Compose to run GlassFlow on your local machine.

| Method                         | Use Case                                | Docs Link                                                                 |
|-------------------------------|------------------------------------------|---------------------------------------------------------------------------|
| ☸️ **Kubernetes with Helm**         | Kubernetes deployment    | [Kubernetes Helm Guide](https://docs.glassflow.dev/installation/kubernetes-helm) |
| 🐳 **Local with Docker Compose**    | Quick evaluation and local testing         | [Local Docker Guide](https://docs.glassflow.dev/installation/local-docker)     |
| ☁️ **AWS EC2 with Docker Compose** | Lightweight cloud deployment for testing   | [AWS EC2 Guide](https://docs.glassflow.dev/installation/aws-ec2)               |


## 🎥 Demo

### Live Demo
Log in and see a working demo of GlassFlow running on a GPC cluster at [demo.glassflow.dev](https://demo.glassflow.dev). You will see a Grafana dashboard and the setup that we used.

![GlassFlow Pipeline Data Flow](https://raw.githubusercontent.com/glassflow/clickhouse-etl/main/docs/public/assets/glassflow_demo.png)

*GlassFlow Pipeline showing real-time streaming from Kafka through GlassFlow to ClickHouse*

### Demo Video

[![GlassFlow Overview Video](https://raw.githubusercontent.com/glassflow/clickhouse-etl/main/docs/public/assets/video-banner.png)](https://docs.glassflow.dev/demo)


## 📚 Documentation

For detailed documentation, visit [docs.glassflow.dev](https://docs.glassflow.dev). The documentation includes:

- [Installation Guide](https://docs.glassflow.dev/installation)
- [Usage Guide](https://docs.glassflow.dev/pipeline/usage)
- [Pipeline Configuration](https://docs.glassflow.dev/pipeline/pipeline-configuration)
- [Local Testing](https://docs.glassflow.dev/local-testing)
- [Architecture](https://docs.glassflow.dev/architecture)

## 🗺️ Roadmap

Check out our [public roadmap](https://glassflow.dev/roadmap) to see what's coming next in GlassFlow. We're actively working on new features and improvements based on community feedback.

**Want to suggest a feature?** We'd love to hear from you! Please use our [GitHub Discussions](https://github.com/orgs/glassflow/discussions/categories/ideas) to share your ideas and help shape the future of GlassFlow.


## 	✨ Features

- Real-time data processing from Kafka to ClickHouse
- Deduplication with configurable time windows
- Temporal joins between multiple Kafka topics
- Scalable and robust architecture built for Kubernetes
- Web-based UI for pipeline management
- Docker version for local testing and evaluation

## 🆘 Support

- [Documentation](https://docs.glassflow.dev)
- [GitHub Issues](https://github.com/glassflow/clickhouse-etl/issues)
- [Slack Community](https://join.slack.com/t/glassflowhub/shared_invite/zt-349m7lenp-IFeKSGfQwpJfIiQ7oyFFKg)
- [Email Support](mailto:help@glassflow.dev)

## ⚖️ License

This project is licensed under the [Apache License 2.0](LICENSE).
