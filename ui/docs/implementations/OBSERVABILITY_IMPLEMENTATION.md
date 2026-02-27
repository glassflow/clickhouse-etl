# Observability Implementation

## Overview

The observability system implements an **OpenTelemetry-first** approach for structured logging and metrics in the UI. All log statements use a `structuredLogger` that emits OTLP log records when enabled, rather than calling `console.*` directly. This aligns the UI with the Go API's observability model (`glassflow-api/pkg/observability/`), allowing both services to ship telemetry to the same OTLP collector.

When OTEL is disabled (the default), the logger falls back to console output so development workflows are unaffected.

## Architecture

```
layout.tsx
├── <Script src="/env.js" strategy="beforeInteractive" />   ← runtime env injected first
└── <ObservabilityProvider>                                  ← initializes client-side OTEL

instrumentation.ts (server)                                  ← initializes server-side OTEL

src/observability/
├── index.ts        initializeObservability(), shutdownObservability()
├── config.ts       loadObservabilityConfig(), observabilityConfig constant, getEnvVar()
├── logger.ts       configureLogger(), structuredLogger, shutdownLogger()
├── metrics.ts      configureMetrics(), metricsRecorder, getUIMetrics(), shutdownMetrics()
├── resource.ts     buildResourceAttributes()
└── semconv.ts      service.name / service.version / service.namespace / service.instance.id
```

## Module Responsibilities

### `config.ts`

Reads all OTEL env vars via `getEnvVar(key)`, which checks `window.__ENV__` first (client runtime injection) then falls back to `process.env` (server or build-time). Exports:

- `loadObservabilityConfig()` — fresh read every call; used by `instrumentation.ts`.
- `observabilityConfig` — module-level constant evaluated once at import time; used by client-side code (safe because `env.js` loads with `beforeInteractive`, so `window.__ENV__` is populated before the bundle evaluates).

### `logger.ts`

- `configureLogger(config)` — creates `LoggerProvider` with `BatchLogRecordProcessor` + `OTLPLogExporter`. In `debug` log level, also adds a `ConsoleLogRecordExporter`. Sets the global OTEL logger provider.
- `structuredLogger` — the single logging interface for the entire UI. Each method (`debug`, `info`, `warn`, `error`) emits an OTEL `LogRecord` (when the logger is configured) and mirrors to `console.*` when `consoleLogsEnabled` is true.
- `structuredLogger.with(attrs)` — returns a child logger that merges `attrs` into every call.
- `shutdownLogger()` — flushes pending records and cleans up.

### `metrics.ts`

- `configureMetrics(config)` — creates `MeterProvider` with `PeriodicExportingMetricReader` (10 s interval) + `OTLPMetricExporter`. Sets the global OTEL meter provider and initializes all counters/histograms.
- `metricsRecorder` — convenience helpers that guard against uninitialized state (no-op if metrics are disabled).
- `getUIMetrics()` — returns the raw `UIMetrics` object for cases where helpers are insufficient.
- `shutdownMetrics()` — flushes and cleans up.

### `resource.ts`

Builds an OTEL `Resource` from `ObservabilityConfig`. Always includes `service.name` and `service.version`; conditionally adds `service.namespace` and `service.instance.id` when set.

### `semconv.ts`

Local semantic conventions constants (`service.name`, `service.version`, `service.namespace`, `service.instance.id`). `service.name` and `service.version` are imported from `@opentelemetry/semantic-conventions`; the others are defined locally to avoid pulling unreleased incubating packages.

### `index.ts`

Re-exports everything and provides the two lifecycle functions:

- `initializeObservability()` — calls `configureLogger` and/or `configureMetrics` depending on which are enabled. Uses the cached `observabilityConfig` constant (see config.ts note above).
- `shutdownObservability()` — dynamically imports and calls both shutdown functions.

## Initialization Flows

### Server-side (API routes, server components)

`instrumentation.ts` (Next.js instrumentation hook) runs once when the server process starts:

```typescript
export async function register() {
  const { configureLogger } = await import('./src/observability/logger')
  const { loadObservabilityConfig } = await import('./src/observability/config')
  configureLogger(loadObservabilityConfig())
}
```

It calls `loadObservabilityConfig()` directly (not the cached constant) to get a fresh read from `process.env`. Server-side code then uses `structuredLogger` for all log output.

### Client-side (browser)

1. Browser receives the HTML page.
2. `env.js` executes (via `strategy="beforeInteractive"`) and sets `window.__ENV__` with all runtime values.
3. Next.js JS bundle evaluates; `config.ts` module initializes `observabilityConfig` from `window.__ENV__`.
4. React hydrates; `ObservabilityProvider` mounts in `layout.tsx`.
5. `useEffect` fires → `initializeObservability()` → logger and/or metrics are configured if enabled.
6. All subsequent `structuredLogger` calls emit OTLP records.

## Environment Variables

All env vars are `NEXT_PUBLIC_*` so they can be injected at runtime via `window.__ENV__`. They are handled by both injection paths:

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_OTEL_LOGS_ENABLED` | `false` | Enable OTLP log export |
| `NEXT_PUBLIC_OTEL_METRICS_ENABLED` | `false` | Enable OTLP metrics export |
| `NEXT_PUBLIC_OTEL_SERVICE_NAME` | `glassflow-ui` | `service.name` resource attribute |
| `NEXT_PUBLIC_OTEL_SERVICE_VERSION` | `dev` | `service.version` resource attribute |
| `NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE` | _(empty)_ | `service.namespace` resource attribute |
| `NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID` | _(empty)_ | `service.instance.id` resource attribute |
| `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP collector base URL |
| `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS` | _(empty)_ | JSON object of headers, e.g. `{"Authorization":"Bearer ..."}` |
| `NEXT_PUBLIC_LOG_LEVEL` | `info` | Minimum log level: `debug\|info\|warn\|error` |
| `NEXT_PUBLIC_OTEL_CONSOLE_LOGS_ENABLED` | _(true)_ | Set to `false` to suppress console mirroring |

### Runtime Injection Paths

Both injection paths must stay in sync — all ten variables above must appear in both files:

- **Docker/production**: `startup.sh` exports defaults and writes `window.__ENV__` to `/app/public/env.js`.
- **Local development**: `generate-env.mjs` reads `.env`/`.env.local` and writes `public/env.js`. It is run via the `predev` script before `next dev` starts.

`next.config.ts` also lists all ten variables under `env:` for build-time embedding (used as a fallback when `window.__ENV__` is unavailable).

### Changing Values at Runtime

1. Set the desired `NEXT_PUBLIC_OTEL_*` / `NEXT_PUBLIC_LOG_LEVEL` variables in the environment.
2. **Docker**: restart the container — `startup.sh` regenerates `env.js` on startup.
3. **Local dev**: run `node generate-env.mjs` (or restart with `npm run dev`) to regenerate `public/env.js`. No `next build` required.

## Metrics Reference

All metric names use the `gfm_ui_` prefix (`GF_METRIC_PREFIX`).

| Metric name | Type | Labels | Description |
|---|---|---|---|
| `gfm_ui_page_views_total` | Counter | `path`, `component` | Page views |
| `gfm_ui_page_load_duration_seconds` | Histogram | `path`, `component` | Page load time (seconds) |
| `gfm_ui_button_clicks_total` | Counter | `button_name`, `component` | Button clicks |
| `gfm_ui_form_submissions_total` | Counter | `form_name`, `success`, `component` | Form submissions |
| `gfm_ui_api_request_count` | Counter | `method`, `path`, `status`, `component` | API request count |
| `gfm_ui_api_request_duration_seconds` | Histogram | `method`, `path`, `status`, `component` | API request duration |
| `gfm_ui_api_request_errors_total` | Counter | `method`, `path`, `status`, `component` | API errors (status ≥ 400) |
| `gfm_ui_pipeline_created_total` | Counter | `pipeline_type`, `component` | Pipelines created |
| `gfm_ui_pipeline_deleted_total` | Counter | `pipeline_id`, `component` | Pipelines deleted |
| `gfm_ui_pipeline_status_changed_total` | Counter | `pipeline_id`, `from_status`, `to_status`, `component` | Status transitions |

Export interval: 10 seconds (matches Go API).

## Usage

### Logging

```typescript
import { structuredLogger } from '@/src/observability'

// Basic usage
structuredLogger.info('Pipeline created', { pipeline_id: id, pipeline_type: type })
structuredLogger.error('API call failed', { endpoint: url, status_code: status })

// Child logger with shared context
const log = structuredLogger.with({ module: 'kafka', pipeline_id: id })
log.debug('Connecting to broker', { broker: host })
log.warn('Partition lag detected', { lag: value })
```

### Metrics

```typescript
import { metricsRecorder } from '@/src/observability'

metricsRecorder.recordPageView('/pipelines')
metricsRecorder.recordApiRequest('GET', '/ui-api/pipeline', 200, 0.42)
metricsRecorder.recordPipelineCreated('deduplication')
metricsRecorder.recordPipelineStatusChange(id, 'running', 'stopped')
```

For metric types not covered by `metricsRecorder`, use `getUIMetrics()`:

```typescript
import { getUIMetrics } from '@/src/observability'
const m = getUIMetrics()
m.buttonClicks.add(1, { button_name: 'retry', component: 'glassflow_ui' })
```

## OTLP Endpoint Configuration

Logs are exported to `{NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`.
Metrics are exported to `{NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`.

Headers (e.g. for authenticated collectors) are set via `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS` as a JSON string:

```
NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS={"Authorization":"Bearer my-token","X-Tenant":"acme"}
```

## Error and Fallback Behavior

- If `NEXT_PUBLIC_OTEL_LOGS_ENABLED` is not `"true"`, `configureLogger` returns early and `structuredLogger` emits nothing to OTLP. Console mirroring still works if `consoleLogsEnabled` is true.
- If the OTLP endpoint is unreachable, `BatchLogRecordProcessor` and `PeriodicExportingMetricReader` will retry internally and eventually drop records silently — no crash or error cascade.
- `configureLogger`/`configureMetrics` wrap setup in `try/catch`; a misconfigured exporter logs to `console.error` and leaves the provider unconfigured (no-op state).
- `structuredLogger` methods guard on `logger === null`; they are safe to call before initialization or after shutdown.
- `metricsRecorder` helpers guard on `uiMetrics === null` and are no-ops when metrics are disabled.

## Constraints

- **Do not bypass `structuredLogger`** with raw `console.*` calls in application code. The structured logger is the single logging interface; it handles both OTLP dispatch and console mirroring based on config.
- **Do not call `initializeObservability()` more than once.** `ObservabilityProvider` uses a `useEffect` with empty deps, so it fires once on mount. Calling it again sets a second global provider on top of the first.
- **`getUIMetrics()` throws if metrics are disabled.** Guard calls with `NEXT_PUBLIC_OTEL_METRICS_ENABLED` check or wrap in try/catch; prefer `metricsRecorder` helpers which null-check internally.
- **Keep injection files in sync.** Any new `NEXT_PUBLIC_OTEL_*` variable added to `config.ts` must also be added to `startup.sh`, `generate-env.mjs`, and `next.config.ts`. Missing any one of these means the variable cannot be overridden at runtime.

## Related

- Agent-facing summary: [`.cursor/architecture/OBSERVABILITY.md`](../../.cursor/architecture/OBSERVABILITY.md)
- Environment variable system: [`.cursor/architecture/ENVIRONMENT.md`](../../.cursor/architecture/ENVIRONMENT.md)
- Implementations index: [`.cursor/architecture/IMPLEMENTATIONS_INDEX.md`](../../.cursor/architecture/IMPLEMENTATIONS_INDEX.md)
