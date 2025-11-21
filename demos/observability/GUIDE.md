# OpenTelemetry Demo - Step-by-Step Guide

This guide provides detailed instructions for running the OpenTelemetry demo that showcases how **Glassflow adds a robust layer to your telemetry stack**.

## Overview

This demo showcases how Glassflow enhances your telemetry stack by:

- **Providing declarative pipeline management** - Define data flows as code (JSON pipelines)
- **Adding resilience and reliability** - Automatic retries, batching, and error handling
- **Enabling data transformation** - Schema mapping, deduplication, and field transformations
- **Orchestrating complex data flows** - Manage Kafka consumer groups, backpressure, and throughput
- **Simplifying operations** - Single API to manage all telemetry pipelines

## Architecture & Data Flow

```
┌─────────────────┐
│  TelemetryGen   │  Generates logs, metrics, and traces
│   (Simulator)   │
└────────┬────────┘
         │ OTLP (gRPC/HTTP)
         ▼
┌─────────────────┐
│ OTel Collector  │  Receives telemetry via OTLP
│                 │  Processes & batches data
└────────┬────────┘
         │ Kafka Producer
         ▼
┌─────────────────┐
│      Kafka      │  Message broker (topics per telemetry type)
│                 │  - otel-logs
└────────┬────────┘  - otel-traces
         │           - otel-metrics-*
         │ Kafka Consumer
         ▼
┌─────────────────┐
│   Glassflow     │  ETL Pipeline Orchestrator
│                 │  - Reads from Kafka topics
└────────┬────────┘  - Transforms & validates data
         │           - Deduplicates (traces)
         │           - Maps schemas
         │           - Batches writes
         │ ClickHouse Native Protocol
         ▼
┌─────────────────┐
│   ClickHouse    │  Time-series database
│                 │  - Stores otel_logs
└────────┬────────┘  - Stores otel_traces
         │           - Stores otel_metrics_*
         │ SQL Queries
         ▼
┌─────────────────┐
│    HyperDX      │  Observability UI
│   (Web App)     │  - Visualizes logs, traces, metrics
└─────────────────┘  - Provides search & analytics
```

### Data Flow Details

1. **Telemetry Generation**: `telemetrygen` jobs generate synthetic OpenTelemetry data (logs, metrics, traces) and send them via OTLP protocol to the OpenTelemetry Collector.

2. **Collection & Processing**: The OpenTelemetry Collector (running as a DaemonSet) receives telemetry via OTLP (gRPC on port 4317). It processes the data through:
   - **Memory limiter**: Prevents OOM issues
   - **Batch processor**: Groups data for efficient transmission
   - **Glassflow exporter**: Custom exporter that publishes to Kafka topics

3. **Message Broker**: Kafka acts as a buffer and decoupling layer. Each telemetry type goes to its own topic:
   - `otel-logs` - Log records
   - `otel-traces` - Trace spans
   - `otel-metrics-sum` - Sum/counter metrics
   - `otel-metrics-gauge` - Gauge metrics
   - `otel-metrics-histogram` - Histogram metrics
   - `otel-metrics-summary` - Summary metrics
   - `otel-metrics-exponential-histogram` - Exponential histogram metrics

4. **Glassflow Pipeline Orchestration**: Glassflow reads from Kafka topics using consumer groups and:
   - Validates data schemas
   - Applies transformations (field mapping, type conversion)
   - Performs deduplication (e.g., trace deduplication by TraceId)
   - Batches records for efficient writes
   - Handles backpressure and retries

5. **Data Storage**: Glassflow writes transformed data to ClickHouse tables:
   - `otel_logs` - Log records with full schema
   - `otel_traces` - Trace spans with relationships
   - `otel_metrics_*` - Various metric types in separate tables

6. **Visualization**: HyperDX queries ClickHouse and provides a web UI for searching, filtering, and visualizing telemetry data.

## Requirements

- `kubectl` configured to connect to your Kubernetes cluster
- `helm` (v3.x) installed
- `kind` (Kubernetes in Docker) - for local cluster setup
- A running Kubernetes cluster (or use kind to create one) with sufficient resources:
  - **Minimum**: 4 CPU cores, 8GB RAM
  - **Recommended**: 6 CPU cores, 12GB RAM (for better performance)
  - **Storage**: ~15GB for persistent volumes (MongoDB requires 10Gi)
  
  **Resource breakdown**:
  - Kafka: 200m CPU / 512Mi RAM (requests), 800m CPU / 2Gi RAM (limits)
  - OpenTelemetry Collector: 200m CPU / 512Mi RAM (requests), 500m CPU / 1Gi RAM (limits)
  - Glassflow: ~500m CPU / ~500Mi RAM (requests), ~1000m CPU / ~2Gi RAM (limits)
  - HyperDX (ClickHouse + App + MongoDB): ~500m CPU / ~1Gi RAM (requests), ~1600m CPU / ~3.5Gi RAM (limits)

**Note**: This demo is configured to run on a kind cluster. The Helm values are optimized for local development with kind.

## Step-by-Step Guide

### Step 0: Create Kind Cluster

If you don't have a Kubernetes cluster, create a kind cluster:

```bash
kind create cluster --name demo
```

This creates a local Kubernetes cluster using Docker. The demo is configured to work with kind's default storage class (`standard`).

### Step 1: Deploy the Complete Stack

Deploy all components in a single command. This will:
1. Add required Helm repositories
2. Create namespaces (kafka, otel, glassflow, hyperdx)
3. Install Kafka, OpenTelemetry Collector, Glassflow, and HyperDX
4. Wait for Kafka to be ready and create consumer offset topic
5. Wait for ClickHouse to be ready and create OpenTelemetry tables
6. Wait for Glassflow API and deploy all pipelines
7. Deploy telemetry generation jobs

```bash
make deploy-stack
```

**Expected Duration**: 5-10 minutes depending on cluster resources and image pull times.

### Step 2: Verify Deployment

Check that all components are running:

```bash
# Check all pods across namespaces
make status

# Or manually check each namespace
kubectl get pods -n kafka
kubectl get pods -n otel
kubectl get pods -n glassflow
kubectl get pods -n hyperdx
```

All pods should be in `Running` or `Completed` state.

### Step 3: Access the UIs

#### Access HyperDX (Observability UI)

In a terminal, run:

```bash
make pf-hyperdx
```

This port-forwards HyperDX to `http://localhost:3000`. Open your browser and navigate to:
- **URL**: http://localhost:3000
- **Default credentials**: Check HyperDX documentation or logs

You can now:
- Search logs by querying the `otel_logs` table
- View traces by querying the `otel_traces` table
- Explore metrics from the `otel_metrics_*` tables

#### Access Glassflow (Pipeline Management UI)

In another terminal, run:

```bash
make pf-glassflow-ui
```

This port-forwards Glassflow to `http://localhost:8080`. Open your browser and navigate to:
- **URL**: http://localhost:8080

You can:
- View pipeline status and health
- Monitor pipeline throughput
- Check pipeline configurations
- See any errors or retries

### Step 4: Verify Data Flow

#### Check Telemetry Generation

Verify that telemetry jobs are running and generating data:

```bash
kubectl get jobs -n otel
kubectl logs -n otel job/telemetrygen-traces -f
```

#### Check Kafka Topics

Verify data is flowing through Kafka:

```bash
kubectl exec -n kafka kafka-controller-0 -- \
  kafka-topics.sh --bootstrap-server localhost:9092 --list
```

You should see topics like `otel-logs`, `otel-traces`, `otel-metrics-*`.

#### Check Glassflow Pipelines

Verify pipelines are running:

```bash
kubectl get pipelines -n glassflow  # If CRDs are created
# Or check Glassflow UI at http://localhost:8081
```

#### Check ClickHouse Data

Query ClickHouse to verify data is being written:

```bash
kubectl exec -n hyperdx deploy/hyperdx-hdx-oss-v2-clickhouse -- \
  clickhouse-client --query "SELECT count() FROM otel_logs"

kubectl exec -n hyperdx deploy/hyperdx-hdx-oss-v2-clickhouse -- \
  clickhouse-client --query "SELECT count() FROM otel_traces"
```

### Step 5: Explore in HyperDX

Once data is flowing:

1. **View Logs**: In HyperDX, navigate to the logs view and search for recent log entries
2. **View Traces**: Open the traces view to see distributed trace spans
3. **View Metrics**: Check metrics dashboards for gauge, sum, and histogram metrics

### Step 6: Clean Up (When Done)

Remove all components:

```bash
make delete-stack
```

This will:
- Uninstall all Helm releases
- Delete telemetry generation jobs
- Remove namespaces
- Remove Helm repositories

If you created a kind cluster, you can also delete it:

```bash
kind delete cluster --name demo
```

## Configuration Files

### Helm Values

- **`k8s/helm-values/kafka.values.yaml`** - Kafka configuration (single broker, no auth)
- **`k8s/helm-values/otel-collector.values.yaml`** - OTel Collector with Glassflow exporter
- **`k8s/helm-values/hyperdx.values.yaml`** - HyperDX with embedded ClickHouse (configured for kind with `standard` storage class)
- **`k8s/helm-values/glassflow.values.yaml`** - Glassflow configuration

### Glassflow Pipelines

Pipelines are defined in `glassflow-pipelines/`:
- **`logs-pipeline.json`** - Reads `otel-logs` topic, writes to `otel_logs` table
- **`traces-pipeline.json`** - Reads `otel-traces` topic with deduplication, writes to `otel_traces` table
- **`metrics-*-pipeline.json`** - Various metric type pipelines

Each pipeline defines:
- **Source**: Kafka topic, consumer group, schema
- **Sink**: ClickHouse connection, table mapping, batch settings

### Telemetry Generators

Telemetry generation jobs in `k8s/telemetry/`:
- **`log-generator.yaml`** - Generates log records
- **`telemetrygen-traces.yaml`** - Generates trace spans
- **`telemetrygen-metrics-*.yaml`** - Generate various metric types


## Learn More

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Glassflow Documentation](https://glassflow.io/docs)
- [HyperDX Documentation](https://hyperdx.io/docs)
- [ClickHouse Documentation](https://clickhouse.com/docs)

