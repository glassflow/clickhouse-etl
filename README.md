<p align="center">
  <img width="1520" height="870" alt="Image" src="docs/public/assets/Readme Banner.png"/>
</p>
<p align="center">
      <a href="https://glassflow-etl.com"><strong>Docs</strong></a> ·     
      <a href="https://github.com/glassflow/clickhouse-etl/issues"><strong>Report Bug</strong></a> ·
      <a href="https://github.com/orgs/glassflow/discussions/categories/support"><strong>Get Help</strong></a> ·
      <a href="https://glassflow-etl.com/getting-started#demo-video"><strong>Watch Demo</strong></a> ·
      <a href="https://glassflow-etl.com/free-swag"><strong>Free Swag</strong></a>
</p>

<div align="center">

[![Email Support](https://img.shields.io/badge/Email%20Support-help%40glassflow.dev-blue?logo=gmail)](mailto:help@glassflow.dev)
<br>
[![Slack](https://img.shields.io/badge/Join%20Slack-GlassFlow%20Hub-blueviolet?logo=slack)](https://join.slack.com/t/glassflowhub/shared_invite/zt-349m7lenp-IFeKSGfQwpJfIiQ7oyFFKg)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/glassflowdev.svg?style=social&label=Follow%20%40GlassFlow)](https://twitter.com/glassflowdev)
</div>
<div align="center">
  <a href="https://github.com/glassflow/clickhouse-etl/releases">
    <img alt="Latest Release" src="https://img.shields.io/github/v/release/glassflow/clickhouse-etl?label=Latest%20Version">
  </a>
  <a href="https://artifacthub.io/packages/search?repo=glassflow">
    <img alt="Artifact Hub" src="https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/glassflow">
  </a>
</div>

> [!NOTE]
> **GlassFlow ClickHouse ETL** is an open-source project by [GlassFlow](https://glassflow.ai). Its documentation lives at [glassflow-etl.com](https://glassflow-etl.com). Looking for GlassFlow's current product? Visit [glassflow.ai](https://glassflow.ai).

# Ingest your data into ClickHouse from day one

Backfill historical data, keep CDC in sync, handle schema changes, normalize messy data, and keep ClickHouse queries correct.

GlassFlow is an open-source stream processing engine designed for data ingestion and transformation from multiple sources into ClickHouse. GlassFlow comes with the following core functionalities:

- **Stateless transformations**: Powered by the expr expression engine, enabling flexible data transformations using helper functions and standard operators (e.g., removing null values or replacing missing timestamps).
- **Stateful transformations**: A built-in state store allows deduplication logic and temporal joins over configurable time windows.
- **Filtering**: Drop events you don’t want to ingest into ClickHouse before they reach your tables.
- **Ingest only**: Direct data transfer from many sources to ClickHouse without transformations.
- **Metrics & OTEL**: Built-in pipeline metrics with OpenTelemetry support.
- **Dead-Letter-Queue**: Keep pipelines running when faulty events occur. Inspect failed events and reprocess them later.

## ⚡️ Quick Start

To get started with GlassFlow, you can:

1. **Install on Kubernetes**: Follow our [Kubernetes Installation Guide](https://glassflow-etl.com/installation/kubernetes) for any production deployment
2. **Learn More**: Explore our [Usage Guide](https://glassflow-etl.com/usage-guide) to start creating data pipelines


## 🧭 Installation Options

GlassFlow is open source and can be self-hosted on Kubernetes. GlassFlow works with any managed Kubernetes service like AWS EKS, GKE, AKS, and more.

| Method                         | Use Case                                | Docs Link                                                                 |
|-------------------------------|------------------------------------------|---------------------------------------------------------------------------|
| ☸️ **Kubernetes with Helm**         | Production and development deployment    | [Kubernetes Helm Guide](https://glassflow-etl.com/installation/kubernetes) |


## 🎥 Demo

### Demo Video

[![GlassFlow Overview Video](https://raw.githubusercontent.com/glassflow/clickhouse-etl/main/docs/public/assets/video-banner.png)](https://glassflow-etl.com/getting-started#demo-video)


## 📚 Documentation

For detailed documentation, visit [glassflow-etl.com](https://glassflow-etl.com). The documentation includes:

- [Installation Guide](https://glassflow-etl.com/installation)
- [Usage Guide](https://glassflow-etl.com/usage-guide)
- [Pipeline JSON Reference](https://glassflow-etl.com/configuration/pipeline-config-reference)
- [Architecture](https://glassflow-etl.com/architecture)

## 🆘 Support

- [Documentation](https://glassflow-etl.com)
- [GitHub Issues](https://github.com/glassflow/clickhouse-etl/issues)
- [Slack Community](https://join.slack.com/t/glassflowhub/shared_invite/zt-349m7lenp-IFeKSGfQwpJfIiQ7oyFFKg)
- [Email Support](mailto:help@glassflow.dev)

## ⚖️ License

This project is licensed under the [Apache License 2.0](LICENSE).
