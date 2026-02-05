# Architecture Overview (snapshot)

**Canonical full architecture:** [docs/architecture/ARCHITECTURE_OVERVIEW.md](../../docs/architecture/ARCHITECTURE_OVERVIEW.md). Below: snapshot (modules, slices, critical flows, links) only.

## Stack (one line)

Next.js 16 (App Router), React 19, TypeScript, Zustand 5, Shadcn/Tailwind 4, RHF + Zod, dark-only, Auth0 optional, axios.

## Layered flow

UI → Next.js API routes (`app/ui-api/*`) → Client API (`src/api/*`) → Services (`src/services/*`) → Libs (`src/lib/*`) → backend/Kafka/ClickHouse.

## Key decisions (2–3)

- Proxy `/ui-api` to backend; normalize payloads. Zustand slices per domain; core slice = mode (create/edit/view), dirty state, hydration.
- Modules under `src/modules/*`; forms config + schema driven. Dark theme only; tokens in docs.

## Data flow (pipeline)

User edits → RHF + Zod → store updated (dirty tracked) → client API → route → backend → hydrate slices → render.

---

## Modules (src/modules/*)

- `kafka/` – Kafka connection & topic selection
- `clickhouse/` – ClickHouse connection & destination mapping
- `filter/` – Filter expression builder
- `join/` – Join configuration
- `deduplication/` – Deduplication config
- `transformation/` – Transformation config (field passthrough, computed)
- `pipeline-adapters/` – Pipeline version adapters (V1/V2)
- `pipelines/` – Pipeline list/details UI
- `notifications/` – Notification center (panel, settings, channels)
- `create/` – Pipeline creation wizard
- `review/` – Configuration review

## Store slices (src/store/)

- `kafka.store.ts` – Kafka connection
- `topics.store.ts` – Topic selection
- `clickhouse-connection.store.ts` – ClickHouse connection
- `clickhouse-destination.store.ts` – ClickHouse destination/mapping
- `deduplication.store.ts` – Deduplication config
- `join.store.ts` – Join config
- `filter.store.ts` – Filter expression state
- `transformation.store.ts` – Transformation config
- `steps.store.ts` – Wizard step management
- `core.ts` – Pipeline mode, dirty state, hydration
- `notifications.store.ts` – Notification center data (list, filters, panel)

## Directory landmarks

- `src/app/` – pages + `/ui-api` routes
- `src/components/ui|common|shared/` – primitives, reusable, app-wide
- `src/modules/*/` – feature modules (see list above)
- `src/store/` – slices + hydration
- `src/notifications/` – In-app feedback (notify); see ./IN_APP_NOTIFICATIONS.md
- `src/analytics/`, `src/observability/` – tracking, logging/metrics
- `src/config/`, `src/scheme/`, `src/services/`, `src/lib/`, `src/api/`

## Critical flows index

| Flow | Where to read |
|------|----------------|
| Pipeline status (real-time) | [./IMPLEMENTATIONS_INDEX.md](./IMPLEMENTATIONS_INDEX.md) → SSE doc |
| Auth (Auth0 toggle, env) | [./AUTH0_ENV.md](./AUTH0_ENV.md) |
| Config output / pipeline create-edit | [docs/architecture/ARCHITECTURE_OVERVIEW.md](../../docs/architecture/ARCHITECTURE_OVERVIEW.md) (data flow, review) |
| Notification center vs in-app notify | [./NOTIFICATION_CENTER.md](./NOTIFICATION_CENTER.md) vs [./IN_APP_NOTIFICATIONS.md](./IN_APP_NOTIFICATIONS.md) |

## Related docs

- Component: ./COMPONENT_ARCHITECTURE.md
- State: ./STATE_MANAGEMENT.md
- Form: ./FORM_ARCHITECTURE.md
- API: ./API_ARCHITECTURE.md
- Theming: ./THEMING_ARCHITECTURE.md
- Module: ./MODULE_ARCHITECTURE.md
- In-app notifications (notify): ./IN_APP_NOTIFICATIONS.md
- Notification center (panel/store): ./NOTIFICATION_CENTER.md
