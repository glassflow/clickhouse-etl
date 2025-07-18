<a href="https://glassflow.dev">
  <img alt="GlassFlow Logo" src="https://raw.githubusercontent.com/glassflow/clickhouse-etl/main/docs/public/assets/glassfow-banner.jpg">
</a>

<p align="center">
      <a href="https://docs.glassflow.dev"><strong>Docs</strong></a> ·     
      <a href="https://github.com/glassflow/clickhouse-etl/issues"><strong>Report Bug</strong></a> ·
      <a href="https://github.com/orgs/glassflow/discussions/categories/ideas"><strong>Feature Request</strong></a> ·
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

GlassFlow is an open-source ETL tool that enables real-time data processing from Kafka to ClickHouse with features like deduplication and temporal joins.

## ⚡️ Quick Start
This guide walks you through a **local installation using Docker Compose** — perfect for development, testing, or trying out GlassFlow on your machine.

1. Clone the repository:
```bash
git clone https://github.com/glassflow/clickhouse-etl.git
cd clickhouse-etl
```

2. Start the services:
```bash
docker compose up
```

3. Access the web interface at `http://localhost:8080` to configure your pipeline.

4. View the logs:
```bash
# Follow logs in real-time for all containers
docker compose logs -f

# logs for the backend app
docker compose logs app -f

# logs for the UI
docker compose logs ui -f
```

## 🧭 Installation Options

GlassFlow can be installed in a variety of environments depending on your use case. Below is a quick overview:

| Method                         | Use Case                                | Docs Link                                                                 |
|-------------------------------|------------------------------------------|---------------------------------------------------------------------------|
| 🐳 **Local with Docker Compose**    | Quick evaluation and local testing         | [Local Docker Guide](https://docs.glassflow.dev/installation/self-host/local-docker)     |
| ☁️ **AWS EC2 with Docker Compose** | Lightweight cloud deployment for testing   | [AWS EC2 Guide](https://docs.glassflow.dev/installation/self-host/aws-ec2)               |
| ☸️ **Kubernetes with Helm**         | Kubernetes deployment    | [Kubernetes Helm Guide](https://docs.glassflow.dev/installation/self-host/kubernetes-helm) |

> ℹ️ **Note:** The current GlassFlow deployment is not horizontally scalable yet. A new Kubernetes-native, scalable deployment is in development and expected by **end of July**.


## 🎥 Demo

### Live Demo
See a working demo of GlassFlow in action at [demo.glassflow.dev](https://demo.glassflow.dev).

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
- [Load Test Results](https://docs.glassflow.dev/load-test/results) - Performance benchmarks and test results

## 🗺️ Roadmap

Check out our [public roadmap](https://glassflow.dev/roadmap) to see what's coming next in GlassFlow. We're actively working on new features and improvements based on community feedback.

**Want to suggest a feature?** We'd love to hear from you! Please use our [GitHub Discussions](https://github.com/orgs/glassflow/discussions/categories/ideas) to share your ideas and help shape the future of GlassFlow.


## 	✨ Features

- Real-time data processing from Kafka to ClickHouse
- Deduplication with configurable time windows
- Temporal joins between multiple Kafka topics
- Web-based UI for pipeline management
- Docker-based deployment
- Local development environment

## 🆘 Support

- [Documentation](https://docs.glassflow.dev)
- [GitHub Issues](https://github.com/glassflow/clickhouse-etl/issues)
- [Slack Community](https://join.slack.com/t/glassflowhub/shared_invite/zt-349m7lenp-IFeKSGfQwpJfIiQ7oyFFKg)
- [Email Support](mailto:help@glassflow.dev)

## ⚖️ License

This project is licensed under the [Apache License 2.0](LICENSE).
