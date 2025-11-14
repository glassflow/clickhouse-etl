# OpenTelemetry Observability for Glassflow UI

This module provides OpenTelemetry instrumentation for the Glassflow UI, sending logs and metrics to an OpenTelemetry Collector using the OTLP HTTP protocol.

## Architecture

The observability implementation mirrors the Go API's observability structure:

```
Browser → OTLP HTTP → OpenTelemetry Collector → Kafka → Glassflow → ClickHouse
```

## Features

- ✅ **Structured Logging** - Compatible with the API's slog-style logging
- ✅ **Metrics Collection** - Counters, Gauges, and Histograms
- ✅ **OTLP HTTP Export** - Standard OpenTelemetry Protocol
- ✅ **Resource Attributes** - Semantic conventions matching the API
- ✅ **Browser-safe** - Works in both client and server-side Next.js
- ✅ **Graceful Fallback** - Degrades to console logging if OTLP is unavailable

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```bash
# OpenTelemetry Configuration
NEXT_PUBLIC_OTEL_LOGS_ENABLED=true
NEXT_PUBLIC_OTEL_METRICS_ENABLED=true

# Service Configuration (matching API format)
NEXT_PUBLIC_OTEL_SERVICE_NAME=glassflow-ui
NEXT_PUBLIC_OTEL_SERVICE_VERSION=1.0.0
NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE=production
NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID=ui-instance-1

# OTLP Exporter Configuration
NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Optional: OTLP Headers for authentication
# NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS={"Authorization":"Bearer token"}

# Log Level
NEXT_PUBLIC_LOG_LEVEL=info
```

### Resource Attributes

The UI sends the following resource attributes (matching the API):

- `service.name` - Service identifier (e.g., "glassflow-ui")
- `service.version` - Version of the service
- `service.namespace` - Optional namespace (e.g., "production", "staging")
- `service.instance.id` - Unique instance identifier

## Usage

### 1. Provider Setup (Already Configured)

The `ObservabilityProvider` is already integrated in the app layout:

```tsx
// src/app/layout.tsx
<ObservabilityProvider>
  <YourApp />
</ObservabilityProvider>
```

### 2. Logging

```typescript
import { structuredLogger } from '@/src/observability'

// Simple logging
structuredLogger.info('User logged in')
structuredLogger.error('Failed to fetch data')

// Logging with attributes
structuredLogger.info('API request completed', {
  method: 'POST',
  path: '/api/pipeline',
  status: 200,
  duration_ms: 150,
})

// Context logging (with persistent attributes)
const logger = structuredLogger.with({
  user_id: '12345',
  request_id: 'abc-123',
})

logger.info('Processing request')
logger.error('Request failed', { error: 'Network timeout' })
```

**Log Levels:**

- `debug` - Detailed debugging information
- `info` - General informational messages
- `warn` - Warning messages
- `error` - Error messages

### 3. Metrics

```typescript
import { metricsRecorder } from '@/src/observability'

// Record page views
metricsRecorder.recordPageView('/pipelines')

// Record page load time
const startTime = performance.now()
// ... page loads ...
const duration = (performance.now() - startTime) / 1000
metricsRecorder.recordPageLoad('/pipelines', duration)

// Record button clicks
metricsRecorder.recordButtonClick('create-pipeline')

// Record form submissions
metricsRecorder.recordFormSubmission('pipeline-form', true)

// Record API calls
const apiStart = performance.now()
const response = await fetch('/api/pipelines')
const apiDuration = (performance.now() - apiStart) / 1000
metricsRecorder.recordApiRequest('GET', '/api/pipelines', response.status, apiDuration)

// Record pipeline operations
metricsRecorder.recordPipelineCreated('kafka-to-clickhouse')
metricsRecorder.recordPipelineDeleted('pipeline-123')
metricsRecorder.recordPipelineStatusChange('pipeline-123', 'stopped', 'running')
```

### 4. Custom Metrics (Advanced)

```typescript
import { getUIMetrics } from '@/src/observability'

const metrics = getUIMetrics()

// Use metrics directly
metrics.pageViews.add(1, {
  path: '/custom-path',
  component: 'custom-component',
})

metrics.apiRequestDuration.record(0.25, {
  method: 'POST',
  path: '/api/custom',
  status: '201',
})
```

## Log Format

Logs are sent in this format (matching the API's expectations):

```json
{
  "Timestamp": "2024-11-14T12:00:00.000000000Z",
  "SeverityText": "INFO",
  "SeverityNumber": 9,
  "ServiceName": "glassflow-ui",
  "Body": "User logged in successfully",
  "ResourceAttributes": {
    "service.name": "glassflow-ui",
    "service.version": "1.0.0",
    "service.instance.id": "ui-instance-1"
  },
  "LogAttributes": {
    "user_id": "12345",
    "action": "login"
  }
}
```

## Metrics Format

Metrics follow OpenTelemetry's standard format:

**Counter Example:**

```json
{
  "ServiceName": "glassflow-ui",
  "MetricName": "gfm_ui_button_clicks_total",
  "MetricDescription": "Total number of button clicks",
  "MetricUnit": "1",
  "Attributes": {
    "button_name": "create-pipeline",
    "component": "glassflow_ui"
  },
  "Value": 42.0,
  "TimeUnix": "2024-11-14T12:00:00.000000000Z"
}
```

## Available Metrics

### UI Metrics (prefix: `gfm_ui_`)

| Metric                          | Type      | Description                |
| ------------------------------- | --------- | -------------------------- |
| `page_views_total`              | Counter   | Total number of page views |
| `page_load_duration_seconds`    | Histogram | Page load duration         |
| `button_clicks_total`           | Counter   | Total button clicks        |
| `form_submissions_total`        | Counter   | Total form submissions     |
| `api_request_count`             | Counter   | Total API requests         |
| `api_request_duration_seconds`  | Histogram | API request duration       |
| `api_request_errors_total`      | Counter   | Total API errors           |
| `pipeline_created_total`        | Counter   | Total pipelines created    |
| `pipeline_deleted_total`        | Counter   | Total pipelines deleted    |
| `pipeline_status_changed_total` | Counter   | Total status changes       |

## Testing

### 1. Local Testing with OpenTelemetry Collector

See the main [Observability Demo](../../../demos/observability/README.md) for setting up a complete stack.

For quick local testing:

1. **Start OpenTelemetry Collector**:

```bash
docker run -p 4318:4318 -p 4317:4317 \
  -v $(pwd)/otel-collector-config.yaml:/etc/otelcol/config.yaml \
  otel/opentelemetry-collector:latest
```

2. **Configure the UI**:

```bash
# .env.local
NEXT_PUBLIC_OTEL_LOGS_ENABLED=true
NEXT_PUBLIC_OTEL_METRICS_ENABLED=true
NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

3. **Run the UI**:

```bash
npm run dev
```

4. **Verify data**:

- Check collector logs for incoming data
- Logs endpoint: `http://localhost:4318/v1/logs`
- Metrics endpoint: `http://localhost:4318/v1/metrics`

### 2. Testing with the Full Stack

Follow the [Observability Demo Guide](../../../demos/observability/GUIDE.md) to deploy:

- Kafka
- OpenTelemetry Collector
- Glassflow pipelines
- ClickHouse
- HyperDX (visualization)

Then query ClickHouse to see UI logs and metrics:

```sql
-- View UI logs
SELECT * FROM otel_logs
WHERE ServiceName = 'glassflow-ui'
ORDER BY Timestamp DESC
LIMIT 10;

-- View UI metrics
SELECT * FROM otel_metrics_sum
WHERE ServiceName = 'glassflow-ui'
ORDER BY TimeUnix DESC
LIMIT 10;
```

## Troubleshooting

### Logs not appearing

1. Check that `NEXT_PUBLIC_OTEL_LOGS_ENABLED=true`
2. Verify OTLP endpoint is reachable: `curl http://localhost:4318/v1/logs`
3. Check browser console for initialization messages
4. Verify collector is running and configured correctly

### Metrics not appearing

1. Check that `NEXT_PUBLIC_OTEL_METRICS_ENABLED=true`
2. Metrics are exported every 10 seconds (batch interval)
3. Check browser console for errors
4. Verify collector metrics endpoint: `curl http://localhost:4318/v1/metrics`

### CORS errors

If you see CORS errors in the browser console:

1. Add CORS headers to your OpenTelemetry Collector config:

```yaml
receivers:
  otlp:
    protocols:
      http:
        cors:
          allowed_origins:
            - 'http://localhost:8080'
            - 'http://localhost:3000'
```

2. Or use a proxy in your Next.js app (see `next.config.ts`)

## Compatibility

This implementation is compatible with:

- ✅ OpenTelemetry Collector v0.90+
- ✅ Next.js 15.x
- ✅ React 19.x
- ✅ Browser environments (Chrome, Firefox, Safari, Edge)
- ✅ Glassflow API observability format

## File Structure

```
src/observability/
├── config.ts         # Configuration and environment variables
├── resource.ts       # Resource attributes builder
├── logger.ts         # Structured logging with OTLP export
├── metrics.ts        # Metrics collection and export
├── index.ts          # Main module exports
└── README.md         # This file
```

## References

- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [Glassflow API Observability](../../../glassflow-api/pkg/observability/)
- [Observability Demo](../../../demos/observability/)
