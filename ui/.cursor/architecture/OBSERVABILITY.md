# Observability Architecture

## Overview

OpenTelemetry-first logging and metrics for the UI, aligned with the Go API's observability model. All application log statements use `structuredLogger` (OTLP when enabled, console fallback when disabled). Runtime-configurable via env vars — no rebuild required to toggle or reconfigure OTEL.

## Key Files

- `src/observability/index.ts` – lifecycle: `initializeObservability()`, `shutdownObservability()`, re-exports.
- `src/observability/config.ts` – `loadObservabilityConfig()`, cached `observabilityConfig` constant, `getEnvVar()` helper.
- `src/observability/resource.ts` – builds OTEL `Resource` from service name/version/namespace/instance.
- `src/observability/logger.ts` – `configureLogger()`, `structuredLogger`, `shutdownLogger()`.
- `src/observability/metrics.ts` – `configureMetrics()`, `metricsRecorder`, `getUIMetrics()`, `shutdownMetrics()`.
- `src/observability/semconv.ts` – semantic convention constants.
- `src/components/providers/ObservabilityProvider.tsx` – client-side initialization via `useEffect`.
- `instrumentation.ts` – server-side initialization (Next.js instrumentation hook).

## Env Configuration (runtime)

Runtime values come from `window.__ENV__` (client) or `process.env` (server), read via `getEnvVar()` in `config.ts`. Both injection paths must include all variables — see constraints below.

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_OTEL_LOGS_ENABLED` | `false` | Enable OTLP log export |
| `NEXT_PUBLIC_OTEL_METRICS_ENABLED` | `false` | Enable OTLP metrics export |
| `NEXT_PUBLIC_OTEL_SERVICE_NAME` | `glassflow-ui` | `service.name` resource attribute |
| `NEXT_PUBLIC_OTEL_SERVICE_VERSION` | `dev` | `service.version` resource attribute |
| `NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE` | _(empty)_ | `service.namespace` resource attribute |
| `NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID` | _(empty)_ | `service.instance.id` resource attribute |
| `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP collector base URL |
| `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS` | _(empty)_ | JSON headers for authenticated collectors |
| `NEXT_PUBLIC_LOG_LEVEL` | `info` | `debug\|info\|warn\|error` |
| `NEXT_PUBLIC_OTEL_CONSOLE_LOGS_ENABLED` | _(true)_ | Set to `false` to suppress console mirroring |

Client-side values come from `window.__ENV__` (runtime injection), not build-time `process.env`, to avoid Next.js inlining. Changing values at runtime: update env vars and restart (Docker) or run `node generate-env.mjs` (dev) — no `next build` needed.

## Injection Files (must stay in sync)

Any new `NEXT_PUBLIC_OTEL_*` variable must be added to **all four**:

1. `startup.sh` – Docker runtime: default exports + `window.__ENV__` block.
2. `generate-env.mjs` – local dev: `envVars` object + template string.
3. `next.config.ts` – build-time fallback via `env:`.
4. `src/observability/config.ts` – consumed by `loadObservabilityConfig()`.

## Initialization

- **Server**: `instrumentation.ts` calls `loadObservabilityConfig()` fresh and passes it to `configureLogger()` when the Node.js process starts.
- **Client**: `layout.tsx` loads `/env.js` with `strategy="beforeInteractive"` (sets `window.__ENV__` before bundle eval), then `ObservabilityProvider` calls `initializeObservability()` in `useEffect` on mount.

## Logging

```typescript
import { structuredLogger } from '@/src/observability'
structuredLogger.info('Pipeline created', { pipeline_id: id })
const log = structuredLogger.with({ module: 'kafka' })
log.warn('Broker unreachable', { broker: host })
```

- Levels: `debug | info | warn | error`.
- `structuredLogger.with(attrs)` returns a child logger with merged attributes.
- When logs are disabled, `structuredLogger` is a no-op for OTLP; console mirroring still runs unless `NEXT_PUBLIC_OTEL_CONSOLE_LOGS_ENABLED=false`.

## Metrics

```typescript
import { metricsRecorder } from '@/src/observability'
metricsRecorder.recordPageView('/pipelines')
metricsRecorder.recordApiRequest('GET', '/ui-api/pipeline', 200, 0.42)
metricsRecorder.recordPipelineCreated('deduplication')
```

- `metricsRecorder` helpers are no-ops when metrics are disabled (safe to call unconditionally).
- All metric names use `gfm_ui_` prefix; exported every 10 s via OTLP HTTP.
- Use `getUIMetrics()` for direct counter/histogram access (throws if metrics are disabled).

## Error/Fallback Behavior

- OTEL disabled → `structuredLogger` no-ops for OTLP, console mirroring controlled by `consoleLogsEnabled`.
- OTLP endpoint unreachable → records batched and eventually dropped; no crash.
- Setup errors in `configureLogger`/`configureMetrics` are caught; logged to `console.error`; provider left null (no-op).

## Constraints

- Use `structuredLogger` everywhere — do not call `console.*` directly in application code.
- Do not call `initializeObservability()` more than once; it sets global OTEL providers.
- `getUIMetrics()` throws if metrics are disabled; prefer `metricsRecorder` helpers.
- Keep all four injection files in sync when adding OTEL vars (see above).

## Related Docs

- Deep reference: [`docs/implementations/OBSERVABILITY_IMPLEMENTATION.md`](../../docs/implementations/OBSERVABILITY_IMPLEMENTATION.md)
- Environment system: `.cursor/architecture/ENVIRONMENT.md`
- Implementations index: `.cursor/architecture/IMPLEMENTATIONS_INDEX.md`
- API rules (error handling): `.cursor/api.mdc`
