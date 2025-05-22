<a href="https://glassflow.dev">
  <img alt="GlassFlow Logo" src="https://raw.githubusercontent.com/glassflow/clickhouse-etl/main/docs/public/assets/glassfow-banner.jpg">
</a>
<div align="center">
<div>      
      <a href="https://github.com/glassflow/clickhouse-etl/issues"><strong>Report Bug</strong></a> ·
      <a href="https://github.com/orgs/glassflow/discussions/categories/ideas"><strong>Feature Request</strong></a> ·
      <a href="https://github.com/orgs/glassflow/discussions/categories/support"><strong>Get Help</strong></a> ·
      <a href="https://docs.glassflow.dev/demo"><strong>Watch Demo</strong></a>      
</div>
</div>


<div align="center">
  <p>Join our weekly office hours every Wednesday 15:00-18:00 CET</p>  
  
[![Join Next Office Hour](https://img.shields.io/badge/Join%20Next%20Office%20Hour-Schedule%20Now-blue?logo=calendar)](https://www.glassflow.dev/office-hours)



[![Slack](https://img.shields.io/badge/Join%20Slack-GlassFlow%20Hub-blueviolet?logo=slack)](https://join.slack.com/t/glassflowhub/shared_invite/zt-349m7lenp-IFeKSGfQwpJfIiQ7oyFFKg)
[![Email Support](https://img.shields.io/badge/Email%20Support-help%40glassflow.dev-blue?logo=gmail)](mailto:help@glassflow.dev)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/glassflowdev.svg?style=social&label=Follow%20%40GlassFlow)](https://twitter.com/glassflowdev)
</div>




# GlassFlow for ClickHouse Streaming ETL

GlassFlow is an open-source ETL tool that enables real-time data processing from Kafka to ClickHouse with features like deduplication and temporal joins.

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/glassflow/clickhouse-etl.git
cd clickhouse-etl
```

2. Start the services:
```bash
docker-compose up
```

3. Access the web interface at `http://localhost:8080` to configure your pipeline.


## Demo

[![GlassFlow Overview Video](https://raw.githubusercontent.com/glassflow/clickhouse-etl/main/docs/public/assets/video-banner.png)](https://docs.glassflow.dev/demo)



## Documentation

For detailed documentation, visit [docs.glassflow.dev](https://docs.glassflow.dev). The documentation includes:

- [Installation Guide](https://docs.glassflow.dev/installation)
- [Usage Guide](https://docs.glassflow.dev/pipeline/usage)
- [Pipeline Configuration](https://docs.glassflow.dev/pipeline/pipeline-configuration)
- [Local Testing](https://docs.glassflow.dev/local-testing)
- [Architecture](https://docs.glassflow.dev/architecture)
- [Load Test Results](https://docs.glassflow.dev/load-test/results) - Performance benchmarks and test results

## Features

- Real-time data processing from Kafka to ClickHouse
- Deduplication with configurable time windows
- Temporal joins between multiple Kafka topics
- Web-based UI for pipeline management
- Docker-based deployment
- Local development environment

## Support

- [Documentation](https://docs.glassflow.dev)
- [GitHub Issues](https://github.com/glassflow/clickhouse-etl/issues)
- [Slack Community](https://join.slack.com/t/glassflowhub/shared_invite/zt-349m7lenp-IFeKSGfQwpJfIiQ7oyFFKg)
- [Email Support](mailto:help@glassflow.dev)

## License

This project is licensed under the [Apache License 2.0](LICENSE).
