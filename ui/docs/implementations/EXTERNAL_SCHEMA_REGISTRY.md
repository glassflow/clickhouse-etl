# External Schema Registry — Implementation

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Schema Registry credentials in Kafka Connection step | ✅ Done |
| Phase 2 | Schema source selection in Topic Selection step | ✅ Done |
| Phase 3 | Type Verification read-only mode for external schema | ✅ Done |
| Phase 4 | V3 adapter: `schema_registry` + `schema_fields` always emitted | ✅ Done |
| Phase 5 | Review step shows schema registry URL and per-topic schema source | ✅ Done |
| Phase A | Schema Registry auth method selector (none / api_key / basic) | ✅ Done |
| Phase B | Confluent wire format auto-resolution from sample event | ✅ Done |
| Phase C | `schemaSource` enum expanded, `isRegistrySchema` helper, downstream normalization | ✅ Done |
| Phase 6 | Pipeline page version selector | ⏳ Deferred — backend endpoint not yet available |

---

## Overview

Adds support for an external (Confluent-compatible) Schema Registry in the pipeline creation journey.
The backend already supports `schema_registry` per topic. The UI allows users to:

- Connect a Schema Registry (with multiple auth methods)
- Load field schema from the registry manually (subject + version selection)
- Auto-detect schema from Confluent wire-format sample events
- See the schema source clearly at Type Verification and Review steps

---

## Background: Backend pipeline JSON (V3)

Each topic in `source.topics[]` has:

```json
{
  "name": "orders",
  "schema_registry": {
    "url": "https://registry.example.com",
    "api_key": "key",
    "api_secret": "secret"
  },
  "schema_version": "3",
  "schema_fields": [
    { "name": "order_id", "type": "string" },
    { "name": "amount",   "type": "float" }
  ]
}
```

When `schema_registry.url` is non-empty, the backend uses the registry for schema evolution.
`schema_fields` is always provided regardless of schema source.

---

## Phases 1–5 (complete)

- **Phase 1**: `schemaRegistry: { enabled, url, apiKey, apiSecret }` added to `kafkaStore`. Form section with toggle, URL, API Key, API Secret.
- **Phase 2**: `schemaSource: 'internal' | 'external'` on topics. `SchemaSourceSelector` component. `useSchemaRegistryState` hook. Subject/version selection UI. API routes: `subjects`, `versions`, `schema`.
- **Phase 3**: `KafkaTypeVerification` read-only mode when `schemaSource === 'external'`. Info banner. Button label "Confirm Schema".
- **Phase 4**: V3 adapter `generate()` emits `schema_registry` (filled/empty) and `schema_fields` for all topics.
- **Phase 5**: Review step shows registry URL and per-topic schema source label.

---

## Phase A — Schema Registry auth method selector

Expands the registry section from a single implicit API key flow to an explicit three-way auth selector.

### Auth methods

| `authMethod` value | Fields shown | HTTP header built |
|--------------------|--------------|-------------------|
| `none` | (none) | (none) |
| `api_key` | API Key (optional), API Secret (optional) | `Basic base64(apiKey:apiSecret)` |
| `basic` | Username (required), Password (required) | `Basic base64(username:password)` |

### Changes

**`src/scheme/kafka.scheme.ts`** — `SchemaRegistryFormSchema` adds:
- `authMethod: z.enum(['none', 'api_key', 'basic']).default('none')`
- `username: z.string().optional()`
- `password: z.string().optional()`

Validation in `superRefine`: when `authMethod === 'basic'`, both `username` and `password` are required.

**`src/store/kafka.store.ts`** — `initialKafkaStore.schemaRegistry` adds `authMethod: 'none'`, `username: ''`, `password: ''`.

**`src/modules/kafka/components/KafkaConnectionFormRenderer.tsx`** — `SchemaRegistrySection` adds an auth method selector between URL and credential fields. Credential fields render conditionally per method.

**`src/app/ui-api/kafka/schema-registry/_auth.ts`** — shared helper `buildRegistryAuthHeaders()`. All 4 routes use this instead of inline header-building.

**`src/store/hydration/kafka-connection.ts`** — infers `authMethod` on hydrate: `api_key` if `api_key` is non-empty, `none` otherwise.

---

## Phase B — Confluent wire format auto-resolution

After a sample Kafka event is fetched, the UI inspects the raw event bytes for the Confluent wire format magic byte (`0x00` at byte 0, followed by a 4-byte big-endian schema ID). If found and a registry is connected, the schema is fetched automatically.

### Changes

**`src/lib/kafka-client.ts`** — `_metadata` in `fetchSampleEvent` now includes `rawBase64: message.value?.toString('base64')`. This makes raw bytes available in `topic.selectedEvent.event._metadata.rawBase64`.

**`src/app/ui-api/kafka/schema-registry/resolve-from-event/route.ts`** — new route:
- Accepts `rawBase64`, registry URL, auth params
- Checks magic byte, extracts schema ID
- Fetches schema from `GET /schemas/ids/{schemaId}`
- Attempts `GET /schemas/ids/{schemaId}/versions` for subject/version (non-fatal if unavailable)
- Returns `{ success, schemaId, subject?, version?, fields }`

**`src/modules/kafka/hooks/useSchemaRegistryState.ts`** — adds `autoResolved` state, `isResolvingFromEvent`, `resolveFromEvent(rawBase64)`, and `applyAutoResolved()`.

**`src/modules/kafka/components/SchemaSourceSelector.tsx`** — watches `topic.selectedEvent.event._metadata?.rawBase64`. When it changes and registry is enabled, calls `resolveFromEvent`. On success, shows a hint banner with a "Use this schema" button that calls `applyAutoResolved()`.

**`src/scheme/topics.scheme.ts`** — `schemaSource` expands to `z.enum(['internal', 'external', 'registry_resolved_from_event'])`.

### Behavior

- Auto-resolution is silent on failure (not Confluent format, registry unreachable, no fields found).
- The radio buttons remain unchanged. The hint banner is additive.
- Only available when using the direct Kafka client (raw bytes not available via gateway client).

---

## Phase C — Schema source normalization

Ensures `topic.schema.fields` shape is consistent regardless of source.

### `isRegistrySchema` helper

`src/modules/kafka/utils/schemaSource.ts`:

```ts
export const isRegistrySchema = (s: string | undefined): boolean =>
  s === 'external' || s === 'registry_resolved_from_event'
```

Used wherever code previously checked `schemaSource === 'external'`:
- `KafkaTypeVerification` — read-only mode
- `V3PipelineAdapter.generate()` — emit non-empty `schema_registry`
- `ReviewConfiguration` — schema source label

### Review labels

| `schemaSource` | Label shown |
|----------------|-------------|
| `registry_resolved_from_event` | "Auto-resolved from event: {subject} v{version}" |
| `external` | "External schema: {subject} v{version}" |
| `internal` (or missing) | "Auto-detected schema" |

### Hydration note

`src/store/hydration/topics.ts` — `schemaSource` is inferred from `schema_registry.url` (non-empty = `'external'`). `schemaRegistrySubject` is not stored in the pipeline JSON and requires re-selection on edit.

---

## Phase 6 — Pipeline page version selector (deferred)

Backend prerequisite: `GET /pipeline/:id/schema-versions` returning valid version combinations. Not yet available.

Once available: parse `source.topics[].schema_version` from fetched pipeline JSON, show version badge, `SchemaVersionSelector` dropdown re-fetches the config at selected version.

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/ui-api/kafka/schema-registry/test-connection` | POST | Test registry reachability, return subject count |
| `/ui-api/kafka/schema-registry/subjects` | POST | List subjects sorted by relevance to topic name |
| `/ui-api/kafka/schema-registry/versions` | POST | List versions for a subject (newest first) |
| `/ui-api/kafka/schema-registry/schema` | POST | Fetch and parse schema fields for subject+version |
| `/ui-api/kafka/schema-registry/resolve-from-event` | POST | Detect Confluent wire format, resolve schema by ID |

All routes accept `{ url, authMethod?, apiKey?, apiSecret?, username?, password? }` for auth.

---

## Key Design Decisions

**schema_fields always provided**: Even for external schema topics, `schema_fields` is always included in the generated JSON. Fields were fetched from the registry at creation time — avoids a registry round-trip and prevents transient availability failures at deploy time.

**Credentials at connection level**: Registry URL/credentials are stored at `kafkaStore` level (one per Kafka cluster). The V3 adapter copies them into each topic's `schema_registry` object.

**API Secret is plain text**: Unlike `root_ca` (base64), schema registry credentials are stored and transmitted as plain strings.

**Subject naming is user-driven**: No naming convention assumed. Subjects are fetched and sorted by relevance to the topic name.

**Registry test is hard-blocking**: If registry is enabled and the connection test fails, the user cannot advance past the Kafka Connection step.

**Auto-resolution is additive**: The hint banner does not replace the explicit radio button. It surfaces a suggestion — the user still controls whether to use it.
