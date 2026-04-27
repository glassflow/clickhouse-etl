# Observability UI — Implementation Reference

This document covers the per-pipeline health, DLQ, and notification surface. It is distinct from `docs/architecture/OBSERVABILITY_IMPLEMENTATION.md`, which covers the OTEL telemetry/structured-logging layer.

---

## Route

`src/app/(shell)/observability/[id]/page.tsx` → `/observability/[id]`

The page is a Next.js **server component**. It:
1. Guards behind `isAuthEnabled()` + `getSessionSafely()` — redirects to `/` if unauthenticated.
2. Server-side fetches `PipelineHealth` from `GET /ui-api/pipeline/[id]/health` with `next: { revalidate: 30 }`.
3. Passes `health` as a prop to `PipelineHealthCard` (no client-side fetch for health).
4. Renders `DLQViewer` and `NotificationChannelConfig` as client components that fetch their own data on mount.

### Layout

```
┌────────────────────────── lg:grid-cols-3 ────────────────────────────┐
│  lg:col-span-2                        │  lg:col-span-1               │
│  PipelineHealthCard (server-fetched)  │  NotificationChannelConfig   │
│  DLQViewer                            │                              │
└───────────────────────────────────────┴──────────────────────────────┘
```

On mobile (< lg) both columns stack vertically.

---

## PipelineHealthCard

`src/modules/pipelines/[id]/PipelineHealthCard.tsx`

```ts
interface PipelineHealthCardProps {
  health: PipelineHealth | null
  isLoading?: boolean
  error?: string | null
}
```

Receives pre-fetched data — it is **not** a client component and makes no requests itself.

**`PipelineHealth`** shape (`src/api/pipeline-health.ts`):

```ts
interface PipelineHealth {
  pipeline_id: string
  pipeline_name: string
  overall_status: PipelineHealthStatus
  created_at: string
  updated_at: string
}

type PipelineHealthStatus =
  | 'Created' | 'Running' | 'Paused' | 'Pausing' | 'Resuming'
  | 'Stopping' | 'Stopped' | 'Terminating' | 'Terminated' | 'Failed'
```

**Display logic**: `getStatusInfo()` maps each `PipelineHealthStatus` to one of four visual states (`stable`, `unstable`, `failed`, `info`) with corresponding CSS token classes. `getHealthStatusDisplayText()` converts status to human-readable text (e.g. `'Created'` → `'Starting...'`).

The card shows: a colored status dot, the display text, and (when `health` is non-null) `overall_status` + `updated_at`. Error and loading states render inline with appropriate token colors.

---

## DLQViewer

`src/modules/observability/DLQViewer.tsx` — client component.

```ts
interface DLQViewerProps { pipelineId: string }
```

### API endpoints used

| Method | Endpoint | When |
|--------|----------|------|
| GET | `/ui-api/pipeline/[id]/dlq/state` | On mount; re-called after consume or purge |
| GET | `/ui-api/pipeline/[id]/dlq/consume?batch_size=N` | When user clicks "Consume" |
| POST | `/ui-api/pipeline/[id]/dlq/purge` | When user confirms purge in `FlushDLQModal` |

**State response shape** (`DLQState`): `{ count?: number, size?: number }`. The component reads `data?.data ?? data` to handle both wrapped and unwrapped backend responses.

### Consume flow

1. User sets batch size (`<Input type="number">`, default 100, range 1–1000).
2. Click "Consume" → `GET /ui-api/pipeline/[id]/dlq/consume?batch_size=N`.
3. On success, displays `"Consumed X events."` and refreshes the DLQ state.

### Purge flow

1. Click "Purge all" opens `FlushDLQModal` (lazy-loaded with `next/dynamic`).
2. Confirm → `POST /ui-api/pipeline/[id]/dlq/purge` → displays `"Error queue cleared."` and refreshes state.
3. Cancel → modal closes, no request made.

Both Consume and Purge buttons are hidden when `count === 0`.

---

## NotificationChannelConfig

`src/modules/observability/NotificationChannelConfig.tsx` — client component.

```ts
interface NotificationChannelConfigProps { pipelineId: string }
```

On mount, fetches `GET /ui-api/notifications?pipeline_id=<id>&limit=10`.

### Severity mapping

```ts
type NotificationSeverity = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
```

`severityVariant(s)` maps severity → `Badge` variant:

| Severity | Badge variant |
|----------|--------------|
| `error`, `fatal` | `error` |
| `warn` | `warning` |
| others | `secondary` |

Each notification renders: severity badge + title (truncated) + formatted timestamp.

### 403 graceful degradation

If the notifications endpoint returns HTTP 403, the component sets `disabled = true` and renders:

> "Notifications are not configured for this environment."

No error is thrown; this is the expected state when the notification service is not deployed.

### `Notification` type (`src/services/notifications-api.ts`)

```ts
interface Notification {
  notification_id: string
  pipeline_id: string
  timestamp: string
  severity: NotificationSeverity
  event_type: EventType   // 'pipeline_deployed' | 'pipeline_stopped' | ...
  title: string
  message: string
  metadata: NotificationMetadata
  created_at: string
  read?: boolean
}
```

`metadata` may arrive as a JSON-encoded string from the notifier service. `normalizeNotification()` in `notifications-api.ts` always parses it to an object before exposing it to consumers.

---

## API endpoints

### DLQ proxy routes (`src/app/ui-api/pipeline/[id]/dlq/`)

All three proxy to `runtimeConfig.apiUrl` (Go backend) via `axios`.

| File | Method | Backend call |
|------|--------|-------------|
| `dlq/state/route.ts` | GET | `GET {API_URL}/pipeline/{id}/dlq/state` |
| `dlq/consume/route.ts` | GET | `GET {API_URL}/pipeline/{id}/dlq/consume?batch_size=N` — requires `batch_size` query param |
| `dlq/purge/route.ts` | POST | `POST {API_URL}/pipeline/{id}/dlq/purge` — backend returns null body on success |

All three validate the pipeline UUID format via `validatePipelineIdOrError(id)` before forwarding.

### Health proxy route

| File | Method | Backend call |
|------|--------|-------------|
| `pipeline/[id]/health/route.ts` | GET | `GET {API_URL}/pipeline/{id}/health` — wraps response in `{ success, health }` |

### Notifications proxy routes (`src/app/ui-api/notifications/`)

The `NotificationsApiClient` in `src/services/notifications-api.ts` is the typed client for these routes. The observability page uses the raw `fetch` call directly (not the class) to keep the component dependency-light.

| Path | Methods |
|------|---------|
| `/ui-api/notifications` | GET (list with filters), POST (not used by this page) |
| `/ui-api/notifications/[id]` | GET, DELETE |
| `/ui-api/notifications/[id]/read` | PATCH |
| `/ui-api/notifications/read-bulk` | PATCH |
| `/ui-api/notifications/delete-bulk` | POST |
| `/ui-api/notifications/channels` | GET |
| `/ui-api/notifications/channels/[type]` | GET, PUT, DELETE |
| `/ui-api/notifications/severity-mappings` | GET, PUT |
| `/ui-api/notifications/severity-mappings/[severity]` | GET, PUT, DELETE |
