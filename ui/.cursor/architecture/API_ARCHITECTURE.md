# API Architecture

## Layers

```
app/ui-api/*        # Next.js route handlers (proxy to backend)
src/api/*           # Client API helpers (fetch/axios)
src/services/*      # Business orchestration
src/lib/*           # Low-level clients (Kafka/ClickHouse)
```

## Next.js API Routes (`app/ui-api/`)

- Purpose: proxy to backend, normalize payloads, handle env, mock mode.
- Examples: `pipeline/route.ts`, `clickhouse/*`, `kafka/*`, `filter/validate`.
- Patterns:
  - Read runtime config from `app/ui-api/config.ts`.
  - Normalize incoming payloads (e.g., broker host mapping, port handling).
  - Return structured JSON `{ success: boolean, ... }`; map backend errors to HTTP status.
  - Keep route handlers thin; defer logic to services/utilities when needed.

## Client API (`src/api/*`)

- Fetch wrappers used by UI components/hooks.
- Examples: `pipeline-api.ts`, `pipeline-health.ts`, `platform-api.ts`, `pipeline-mock.ts`.
- Patterns:
  - Build URL via `getApiUrl` / `isMockMode` (see `utils/mock-api`).
  - Parse/normalize statuses (`parsePipelineStatus`, etc.).
  - Minimal error handling; surface meaningful errors to UI (notifications/logs).

## Services (`src/services/*`)

- Encapsulate business operations beyond simple fetches.
- Examples: `kafka-service.ts`, `clickhouse-service.ts`, `pipeline-state-manager.ts`.
- Patterns:
  - Own retries/cleanup (e.g., disconnect Kafka client in finally).
  - Provide domain-specific helpers (fetch topics, test connections, compute statuses).
  - Remain UI-agnostic; return typed results/errors.

## Libraries (`src/lib/*`)

- Low-level clients or gateways.
- Examples: `kafka-client-factory.ts`, `kafka-client.ts`, `kafka-gateway-client.ts`, `clickhouse-client.archive.ts`.
- Keep these pure and reusable; no UI or store coupling.

## Error Handling

- API routes: catch backend errors, map status/data to JSON `{ success: false, error }`.
- Client API: throw or return typed errors; avoid `any`.
- UI: surface via notifications/toasts with user-friendly messages.

## Mocking

- `isMockMode` flag in runtime/public env; mock routes under `/app/ui-api/mock/*`.
- Client API respects mock mode via `getApiUrl`.

## Conventions

- Keep route handlers small; do not embed business logic in pages/components.
- Use TypeScript types from `src/types` / `src/scheme` where applicable.
- Prefer `fetch` in client API; axios inside routes if already used for backend calls.
- Normalize transformation/status fields client-side to avoid backend misclassification.

## Related Docs

- Architecture Overview: ./ARCHITECTURE_OVERVIEW.md
- Module Architecture: ./MODULE_ARCHITECTURE.md
