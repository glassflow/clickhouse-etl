# Observability Architecture

## Overview

OpenTelemetry-based logging and metrics for the UI, aligned with the API’s observability model. Runtime-configurable via env vars; supports graceful fallback to console when disabled or misconfigured.

## Key Files

- `src/observability/index.ts` – initialization (`initializeObservability`), shutdown, exports.
- `src/observability/config.ts` – loads runtime env (`getRuntimeEnv`) into `ObservabilityConfig`.
- `src/observability/resource.ts` – resource attributes (service name/version/namespace/instance).
- `src/observability/logger.ts` – structured logging (OTLP exporter + console fallback).
- `src/observability/metrics.ts` – metrics recorder (page views, API timings, etc.).
- `src/observability/semconv.ts` – semantic conventions.
- `src/observability/README.md` – detailed usage and examples.

## Env Configuration (runtime)

Loaded via `generate-env.mjs` → `public/env.js` → `getRuntimeEnv()` (client):

- `NEXT_PUBLIC_OTEL_LOGS_ENABLED` (`true|false`)
- `NEXT_PUBLIC_OTEL_METRICS_ENABLED` (`true|false`)
- `NEXT_PUBLIC_OTEL_SERVICE_NAME` (default `glassflow-ui`)
- `NEXT_PUBLIC_OTEL_SERVICE_VERSION` (default `dev`)
- `NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE` (default ``)
- `NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID` (default ``)
- `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`)
- `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS` (JSON string, optional)
- `NEXT_PUBLIC_LOG_LEVEL` (`debug|info|warn|error`, default `info`)

Notes:

- Client-side values come from `window.__ENV__` (runtime) rather than build-time `process.env`, avoiding Next.js inlining issues.
- To change at runtime: update env, regenerate `public/env.js` (via `generate-env.mjs` / restart dev/server).

## Initialization

- `ObservabilityProvider` is mounted in `src/app/layout.tsx`, which loads `/env.js` before hydration.
- `initializeObservability()` reads `observabilityConfig` and sets up logger/metrics if enabled.
- If disabled (env false), modules skip OTLP setup and rely on console as needed.

## Logging

- `structuredLogger` with levels: `debug|info|warn|error`.
- `structuredLogger.with(attrs)` to add persistent attributes.
- Sends OTLP logs when enabled; otherwise console fallback.
- Resource attributes include service metadata from env.

## Metrics

- `metricsRecorder` convenience helpers (page views, loads, button clicks, form submissions, API timing, pipeline events).
- `getUIMetrics()` exposes underlying counters/histograms for custom use.
- Exports via OTLP HTTP; batch interval default inside metrics setup.

## Resource Attributes

- `service.name`, `service.version`, `service.namespace`, `service.instance.id` populated from env; keeps parity with backend observability.

## Error/Fallback Behavior

- If OTLP endpoint unreachable or disabled, logging/metrics degrade gracefully to console/no-op.
- Headers can be set via `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS` for authenticated collectors.

## How to Change at Runtime

1. Set desired `NEXT_PUBLIC_OTEL_*` and `NEXT_PUBLIC_LOG_LEVEL`.
2. Regenerate `public/env.js` (run `node generate-env.mjs` or restart dev/server which runs it).
3. Restart the server process so `env.js` is served and loaded by the client.

## Related Docs

- Environment: `.cursor/architecture/ENVIRONMENT.md`
- Auth0 env: `.cursor/architecture/AUTH0_ENV.md`
- Notifications: `.cursor/architecture/NOTIFICATIONS.md`
- API rules (error handling): `.cursor/api.mdc`
