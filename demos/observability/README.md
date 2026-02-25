# OpenTelemetry Demo with GlassFlow and ClickStack

Kubernetes-based telemetry pipeline: OpenTelemetry Collector → Kafka → Glassflow → ClickHouse → HyperDX

This repository installs a complete observability stack on Kubernetes, including OpenTelemetry Collector (telemetry processing), Kafka (message broker), Glassflow (data pipeline orchestrator), ClickHouse (time-series database), and HyperDX (observability UI). Telemetry generators simulate logs, metrics, and traces for testing.

[![Demo Video](https://i.imgur.com/eggp799.png)](https://www.youtube.com/embed/faabKz3npeo?si=yGZdQgklJwdPwD2a)

## Requirements

- `kubectl` configured to connect to your cluster
- `helm` (v3.x)
- `kind` (Kubernetes in Docker) - for local cluster setup
- A running Kubernetes cluster (or use kind to create one) with:
  - **Minimum**: 4 CPU cores, 8GB RAM
  - **Recommended**: 6 CPU cores, 12GB RAM
  - **Storage**: ~15GB for persistent volumes

## Quick Start

```bash
# 0. Create a kind cluster (if you don't have one)
kind create cluster --name demo

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

# 4. Delete kind cluster (optional)
kind delete cluster --name demo
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
