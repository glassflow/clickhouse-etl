# OpenTelemetry Demo

Kubernetes-based telemetry pipeline: Kafka → OpenTelemetry Collector → Glassflow → ClickHouse → HyperDX

This repository installs a complete observability stack on Kubernetes, including Kafka (message broker), OpenTelemetry Collector (telemetry processing), Glassflow (data pipeline orchestrator), ClickHouse (time-series database), and HyperDX (observability UI). Telemetry generators simulate logs, metrics, and traces for testing.

[![Demo Video](https://i.imgur.com/eggp799.png)](https://www.youtube.com/embed/faabKz3npeo?si=yGZdQgklJwdPwD2a)

## Requirements

- `kubectl` configured to connect to your cluster
- `helm` (v3.x)
- A running Kubernetes cluster

## Quick Start

```bash
# 1. Deploy stack (Kafka, OTel Collector, Glassflow, HyperDX)
#   1.1. Install Repos
#   1.2. Create Namespaces
#   1.3. Install (Kafka, OTel Collector, Glassflow, HyperDX)
#   1.4. Create ClickHouse Tables
#   1.5. Create GlassFlow Pipelines
#   1.6. Deploy telemetry generation jobs
make deploy-stack

# 2. Port-forward GlassFlow and HyperDX
make pf-hyperdx      # Port-forward HyperDX UI to http://localhost:3000
make pf-glassflow    # Port-forward Glassflow UI to http://localhost:8080

# 3. Delete stack (once ready to clean-up)
make delete-stack
```

## Configuration

- **Helm Values**: `k8s/helm-values/` - Kafka, OTel Collector, Glassflow, HyperDX configs
- **Telemetry Jobs**: `k8s/telemetry/` - Log, metrics, and trace generators
- **Glassflow Pipelines**: `glassflow-pipelines/` - Kafka source to ClickHouse sink pipelines

## Architecture

```
TelemetryGen → OTel Collector → Kafka → Glassflow → ClickHouse ← HyperDX
```

## Documentation

For detailed step-by-step instructions, data flow explanation, and troubleshooting, see [GUIDE.md](GUIDE.md).

## References

- [Pipeline Configuration](https://docs.glassflow.dev/configuration/pipeline-json-reference)
- [GlassFlow Otel Exporter](https://github.com/glassflow/opentelemetry-collector-contrib/tree/main/exporter/glassflowexporter)
