# Architecture Overview

## What this app does

GlassFlow ClickHouse ETL UI is a Next.js 16 application for configuring and managing real-time data pipelines between Kafka (or OTLP) sources and ClickHouse. It provides three creation paths — a step-by-step wizard, a visual canvas editor, and an AI-assisted flow — and a library for reusing saved connections and schemas.

---

## Tech stack

| Technology | Role |
|---|---|
| Next.js 16 (App Router) | Framework; server components by default, `'use client'` for hooks/DOM |
| React 19 | UI library |
| TypeScript 5.8 (strict) | Type safety; types inferred from Zod schemas |
| Zustand 5 | Client-side state — slice pattern, devtools, subscribeWithSelector |
| React Hook Form 7 + Zod 3 | Schema-first forms; Manager/Renderer split |
| Radix UI + shadcn/ui | Accessible component primitives |
| Tailwind CSS 4 | Layout/spacing only; colors via CSS tokens, never hardcoded |
| Drizzle ORM | Type-safe DB queries (Postgres/SQLite) |
| `@xyflow/react` | Visual pipeline canvas |
| KafkaJS 2 | Kafka client in API routes |
| `@clickhouse/client` 1 | ClickHouse client in API routes |
| Vitest 2 | Unit and component tests |
| Auth0 (optional) | Authentication — gated by `AUTH_ENABLED` env var |

---

## Route structure

All interactive pages live under two route groups:

### `app/(shell)/` — authenticated app shell

Wrapped by `ShellLayoutClient` (sidebar nav, header). All routes check `isAuthEnabled()` and redirect to `/` if the user is unauthenticated.

```
(shell)/
├── home/                  # Pipeline list (HomePageClient + PipelinesPageClient)
├── pipelines/
│   ├── page.tsx           # Pipelines table — PipelinesPageClient
│   ├── [id]/page.tsx      # Pipeline details — PipelineDetailsModule
│   ├── create/page.tsx    # Wizard — PipelineWizard ('use client')
│   └── create/ai/page.tsx # AI-assisted creation — AiChatPanel + AiIntentSummary
│   └── logs/              # Pipeline log viewer
├── canvas/page.tsx        # Visual canvas editor — CanvasView + CanvasDeployButton
├── library/page.tsx       # Connection/schema library — LibraryClient
├── observability/
│   ├── page.tsx           # Observability index (coming soon placeholder)
│   └── [id]/page.tsx      # Per-pipeline health, DLQ, notification channel config
└── dashboard/page.tsx     # Dashboard — DashboardClient
```

### `app/(main)/` — public / utility pages

```
(main)/
├── welcome/               # Landing page
├── notifications/settings/# Notification preferences
├── test-health/           # Health check dev page
├── test-pipeline-health/  # Pipeline health dev page
└── dev/components/        # Design system component playground
```

### `app/ui-api/` — API routes (Next.js Route Handlers)

Server-only proxy layer to the Go backend. All backend calls go through here — no direct backend calls from the client.

```
ui-api/
├── pipeline/              # CRUD, pause/resume/stop/terminate, SSE status stream
├── pipeline/[id]/dlq/     # DLQ state, consume, purge
├── kafka/                 # Test connection, topics, topic details, events
├── clickhouse/            # Test connection, databases, tables, schema, create/alter/drop table
├── filter/validate        # Filter expression validation
├── transform/expression/evaluate  # Transform expression evaluation
├── library/               # connections (kafka/clickhouse), schemas, folders — CRUD
├── notifications/         # Notification CRUD, bulk read/delete, channel config, severity mappings
├── platform/              # Platform detection
├── healthz/               # Health check
└── mock/                  # Mock endpoints for local dev (mirrors real routes)
```

---

## Store architecture

Single Zustand store composed from slices in `src/store/index.ts`. Access via `const { xStore } = useStore()`.

### Pipeline wizard slices (original)

| Slice | Responsibility |
|---|---|
| `coreStore` (`core.ts`) | Pipeline ID, name, mode (create/edit/view), sourceType, topicCount, dirty flag, save history |
| `kafkaStore` | Kafka connection config: brokers, auth method, security protocol, credential fields |
| `topicsStore` | Selected topics, per-topic schema fields, initial offsets, sample events |
| `deduplicationStore` | Per-topic deduplication config (key, key type, time window) |
| `joinStore` | Join type, stream configs, join keys |
| `filterStore` | Filter expression string, parsed filter config |
| `transformationStore` | Stateless field transformation config, expression string |
| `clickhouseConnectionStore` | ClickHouse connection params (host, ports, credentials, SSL) |
| `clickhouseDestinationStore` | Target database/table, field mappings, batch settings |
| `stepsStore` | Active wizard step, step completion/validation states |
| `resourcesStore` | K8s resource quotas (CPU, memory requests/limits) |
| `otlpStore` | OTLP source config: signal type, endpoint, deduplication |
| `notificationsStore` | In-app notification list, unread count |

### New slices (sprint-1)

| Slice | Responsibility |
|---|---|
| `canvasStore` (`canvas.store.ts`) | ReactFlow nodes/edges, active node ID, per-node configs, source type. `initDefaultPipeline(sourceType)` seeds the default graph. |
| `domainStore` (`domain.store.ts`) | Canonical `PipelineDomain` model — the single source of truth for all three creation lanes (wizard, canvas, AI). `syncFromSlices()` bridges from wizard slices; `toWireFormat()` derives `InternalPipelineConfig`; `getSchema()` threads active transforms through the plugin registry. |
| `deploymentStore` (`deployment.store.ts`) | Runtime deployment state: `pipeline_status`, `version`, timestamps. Separate from design-time config in `domainStore`. |
| `runtimeStore` (`runtime.store.ts`) | Reserved for observability metrics (throughput, lag, error rate). Will be populated by the `/observability` SSE stream in a future sprint. Currently a no-op. |
| `otlpStore` | OTLP source config (signal type, endpoint, schema fields, deduplication) |

### Hydration rule

Never write to slices directly from raw backend data. Use:

- `coreStore.hydrateFromConfig(config)` — full pipeline hydration on load/edit
- `hydrateSection(section, config)` — partial section hydration
- `domainStore.syncFromSlices()` — derive `PipelineDomain` from current wizard slices after any hydration

### Global store actions

```typescript
resetAllPipelineState(topicCount, force?)  // full or partial reset
resetForNewPipeline(topicCount)            // full reset + cookie/history clear
resetFormValidationStates()                // reset validation without losing data
clearAllUserData()                         // nuclear reset
```

---

## Component hierarchy

```
src/components/ui/        ← shadcn/Radix primitives; own all visual state via variant props
src/components/common/    ← domain-neutral patterns used in 2+ places
src/components/shared/    ← app-wide layout, ShellLayoutClient, ThemeProvider, header
src/modules/*/components/ ← feature-specific components with domain logic
```

**Layer rules:**

- `ui/`: extend only for token alignment; never break Radix behavior. Visual state = `variant` prop, not `className`.
- `common/` and `shared/`: consume primitives via `variant`; `className` is for layout (padding, margin, width, flex/grid) only.
- New reusable patterns go to `common/` before graduating to a module.
- `modules/` can only write to the store — never reach across module boundaries directly.

**Root provider stack** (in `app/layout.tsx`):

```
ThemeProvider (dark, enableSystem=false)
  ObservabilityProvider
    AnalyticsProvider
      HealthCheckProvider
        PlatformProvider
          NotificationProvider
            AuthProvider
              ShellLayoutClient (sidebar + header, shell routes only)
```

---

## Adapter layer

`src/adapters/` decouples store state from wire formats. Two adapter families:

### Source adapters (`src/adapters/source/`)

| File | Purpose |
|---|---|
| `source/index.ts` | Factory: `getSourceAdapter(sourceType)` returns `KafkaSourceAdapter` or `OtlpSourceAdapter` |
| `source/kafka/adapter.ts` | `toWireSource()` — builds the `source` section of `InternalPipelineConfig` from store state; `fromWireSource()` — dispatches back to hydration callbacks |
| `source/otlp/adapter.ts` | Same interface for OTLP (logs/traces/metrics) |

`SourceAdapter` interface contract:
- `toWireSource(storeState)` — pure, no side effects
- `fromWireSource(wire, dispatch)` — hydration callbacks only, no direct store writes
- `getTopicStepKeys()` — returns which wizard `StepKeys` are active for this source

### Transform plugins (`src/adapters/transform/`)

Plugin registry pattern. Each transform type (`deduplication`, `join`, `filter`, `stateless`) implements `TransformPlugin<TConfig>`:

```typescript
interface TransformPlugin<TConfig> {
  readonly type: TransformType
  readonly enabled: boolean
  getInputSchema(upstream: SchemaField[]): SchemaField[]
  getOutputSchema(input: SchemaField[], config: TConfig): SchemaField[]
  validate(config: TConfig): { valid: boolean; errors: string[] }
  toWireFormat(config: TConfig): WireTransformConfig
  fromWireFormat(wire: WireTransformConfig): TConfig
}
```

Plugins are self-registering on import (`src/adapters/transform/index.ts` side-effects). `getTransformPlugin(type)` retrieves from registry. `domainStore.getSchema()` chains plugins to compute the effective output schema for the whole transform pipeline.

---

## Persistence layer

`src/lib/db/` — Drizzle ORM, env-based driver selection.

**Schema** (`src/lib/db/schema.ts`) — `ui_library` Postgres schema:

| Table | Columns |
|---|---|
| `folders` | `id`, `name`, `parent_id` (self-ref), `created_at` |
| `kafka_connections` | `id`, `name`, `description`, `folder_id`, `tags (jsonb)`, `config (jsonb: KafkaConfig)`, timestamps |
| `clickhouse_connections` | `id`, `name`, `description`, `folder_id`, `tags (jsonb)`, `config (jsonb: ClickHouseConfig)`, timestamps |
| `schemas` | `id`, `name`, `description`, `folder_id`, `tags (jsonb)`, `fields (jsonb: SchemaField[])`, timestamps |

**Driver selection** (`src/lib/db/index.ts`):

- `DATABASE_URL` set → Postgres via `postgres-js`
- Not set → SQLite via `better-sqlite3` (`.library.db` in project root) — local dev only

Both drivers are accessed through the same Drizzle query builder interface. Migration: `src/lib/db/migrate.ts` + `migrations/0001_initial.sql`. Library CRUD is exposed via `ui-api/library/` routes.

---

## Key conventions

- **No hardcoded colors.** Use CSS tokens: `text-[var(--text-primary)]`, `bg-[var(--surface-bg)]`. No hex, no `rgba()`, no raw Tailwind color utilities.
- **Variant props, not class names.** `<Button variant="primary">`, `<Card variant="dark">`. `className` on wrappers = layout only.
- **Strict TypeScript.** No `any`. Types inferred from Zod schemas. `'use client'` only for hooks/DOM APIs.
- **Server components by default.** Auth checks, data fetching, and env var reads happen server-side.
- **Dark-only.** `ThemeProvider` sets `defaultTheme="dark"` with `enableSystem=false`. No light-theme branches.
- **No inline `style={{}}` on overlay/modal primitives.** Use `modal-overlay` class; tokens apply automatically.
- **Forms are schema-first.** Manager owns `useForm` + Zod schema. Renderer receives `control`. `<FormMessage>` handles all error display.
- **All backend calls via `ui-api/`.** No direct backend calls from client code.
- **`schema-service.ts` is at `src/utils/schema-service.ts`** — not `src/services/`. It delegates schema computation to the transform plugin registry.

---

## Testing

Vitest 2 (`pnpm test` / `pnpm test:run`). Tests co-located with source files.

**Coverage areas:**

| Area | Test files |
|---|---|
| Store slices | `src/store/deduplication.store.test.ts`, `domain.store.test.ts` |
| Adapters | `src/adapters/source/kafka/adapter.test.ts`, `otlp/adapter.test.ts`, `transform/transform-plugins.test.ts` |
| Lib utilities | `src/lib/__tests__/` — circuit-breaker, consumer-tracker, DB schema, Kafka client factory/gateway, retry logic |
| Module components | `src/modules/create/`, `deduplication/`, `filter/`, `join/`, `kafka/`, `pipelines/` — hooks, utils, component tests |
| Utils | `src/utils/` — common, duration, schema-service, type-conversion, pipeline-status-display |
| Config | `src/config/step-registry.test.ts` |
| Hooks | `src/hooks/usePipelineDetailsData.test.ts` |
| Services | `src/services/__tests__/kafka-service.test.ts` |
| Smoke | `src/test/setup.smoke.test.ts` |

Run all tests:
```bash
pnpm test:run
```

---

## Where to look for X

| What | Where |
|---|---|
| Pipeline creation wizard | `src/modules/create/`, `src/app/(shell)/pipelines/create/` |
| Visual canvas editor | `src/modules/canvas/`, `src/app/(shell)/canvas/`, `src/store/canvas.store.ts` |
| AI-assisted creation | `src/modules/ai/`, `src/app/(shell)/pipelines/create/ai/`, `src/store/ai-session.store.ts` |
| Connection/schema library UI | `src/modules/library/`, `src/app/(shell)/library/` |
| Library API routes | `src/app/ui-api/library/` |
| Library DB schema | `src/lib/db/schema.ts` |
| Canonical pipeline domain model | `src/types/pipeline-domain.ts`, `src/store/domain.store.ts` |
| Wire format (InternalPipelineConfig) | `src/types/pipeline.ts` |
| Source adapters (Kafka/OTLP) | `src/adapters/source/` |
| Transform plugins | `src/adapters/transform/` |
| Effective schema computation | `src/utils/schema-service.ts` |
| Pipeline details page | `src/modules/pipelines/[id]/`, `src/app/(shell)/pipelines/[id]/` |
| Observability / DLQ | `src/modules/observability/`, `src/app/(shell)/observability/` |
| All store slices | `src/store/` |
| Store hydration functions | `src/store/hydration/` |
| Zustand store composition | `src/store/index.ts` |
| UI primitives (Button, Card, Badge, etc.) | `src/components/ui/` |
| CSS design tokens | `src/themes/base.css`, `src/themes/theme.css` |
| Typography / animation utilities | `src/app/styles/typography.css`, `src/app/styles/animations.css` |
| API routes (all) | `src/app/ui-api/` |
| Backend service clients | `src/services/` |
| Kafka client factory | `src/lib/kafka-client-factory.ts` |
| Pipeline version adapters (V1/V2/V3) | `src/modules/pipeline-adapters/` |
| Notification system | `src/notifications/`, `src/store/notifications.store.ts` |
| Analytics | `src/analytics/` |
| OpenTelemetry observability | `src/observability/` |
