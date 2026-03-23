# External Schema Registry — Implementation Plan

## Overview

This document describes the plan for adding support for external (Confluent-compatible) Schema Registry
in the pipeline creation journey. It covers UI changes only — the backend already supports
`schema_registry` per topic and handles schema fetching at runtime.

The feature allows users to connect their pipeline to a Schema Registry they own, so that:
- Schema fields are loaded from the registry rather than inferred from Kafka events
- The backend can evolve the pipeline automatically when the Kafka schema changes
- Type Verification becomes a review step rather than a manual annotation step

---

## Background

### Backend pipeline JSON (V3)

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

When `schema_registry.url` is non-empty, the backend knows the topic has an external schema and uses
the registry for schema evolution. `schema_fields` is **always provided** regardless of schema source —
since they were fetched from a trusted registry, sending them avoids a round-trip at creation time and
prevents failures caused by transient registry unavailability at deploy time.

### Current UI state

The V3 adapter always emits `schema_registry: { url: '', api_key: '', api_secret: '' }` (empty).
No schema registry fields exist anywhere in the store, forms, or hydration logic. Type Verification
always requires manual annotation.

---

## Scope: Phases 1–5 (creation journey)

Phase 6 (pipeline page version selector) is tracked separately and has a backend prerequisite.

---

## Phase 1 — Schema Registry Credentials in Kafka Connection Step

### Store changes

`src/store/kafka.store.ts` — add to `KafkaStoreProps`:

```ts
schemaRegistry: {
  enabled: boolean
  url: string
  apiKey: string    // optional, plain string — never base64
  apiSecret: string // optional, plain string — never base64
}
```

- Add `setKafkaSchemaRegistry(config: SchemaRegistryConfig)` action
- `resetKafkaStore` wipes it back to `{ enabled: false, url: '', apiKey: '', apiSecret: '' }`

### Form changes — `KafkaConnectionFormRenderer`

Add an optional collapsible "Schema Registry" section at the bottom of the Kafka connection form:

```
[ ] Use Schema Registry

  └─ when checked:
       Registry URL *    [https://...]
       API Key           [optional]
       API Secret        [optional, type=password]
```

- Checkbox toggles field visibility
- `URL` is required (valid URL format) when `enabled === true` — enforced in Zod schema
- `API Key` and `API Secret` are optional
- `API Secret` is `type="password"` — stored and sent as **plain text, never base64**
- Section is visually separated from core Kafka auth fields

Extend `KafkaConnectionFormSchema` in `src/scheme/kafka.scheme.ts` with a `schemaRegistry` group
using `.superRefine()` or `.refine()` for conditional URL requirement.

### Connection test — schema registry is mandatory if enabled

**Current flow**: click "Continue" → test Kafka → if success → save + advance.

**New flow when `schemaRegistry.enabled === true`**:
1. Test Kafka connection (existing)
2. If Kafka succeeds → test schema registry connection (`POST /ui-api/kafka/schema-registry/test-connection`)
3. If schema registry fails → show error below the section, **do not advance**
4. Only if both succeed → save + advance

Rationale: the backend relies on the registry being reachable at runtime for schema evolution. A
registry that cannot be reached at creation time will cause pipeline failures later.

Error display:
- Kafka error: existing red banner
- Schema registry error: separate inline error inside the schema registry section —
  *"Schema Registry connection failed: [message]. Check the URL and credentials."*

### New UI API route

`POST /ui-api/kafka/schema-registry/test-connection`

```ts
// Request body
{ url: string; apiKey?: string; apiSecret?: string }

// Response
{ success: boolean; message: string; subjectCount?: number }
```

Server-side: calls `GET {url}/subjects` with `Authorization: Basic base64(apiKey:apiSecret)` when
credentials are provided. Returns the count of subjects on success — used for a success message like
*"Connected — 12 subjects available"*. Uses no auth header when credentials are absent.

### Save behavior

`useKafkaConnectionSave`: when saving connection data, also call `setKafkaSchemaRegistry()` with
values from `formValues.schemaRegistry`.

### Hydration

`src/store/hydration/kafka-connection.ts`:

```ts
// Read from first topic's schema_registry (all topics share same registry/cluster)
const schemaReg = pipelineConfig.source.topics[0]?.schema_registry
if (schemaReg?.url) {
  kafkaStore.setKafkaSchemaRegistry({
    enabled: true,
    url: schemaReg.url,
    apiKey: schemaReg.api_key ?? '',
    apiSecret: schemaReg.api_secret ?? '',
  })
}
```

---

## Phase 2 — Schema Source Selection in Topic Selection Step

### Store changes

`src/scheme/topics.scheme.ts` — add to `KafkaTopicType`:

```ts
schemaSource: 'internal' | 'external'  // default: 'internal'
schemaRegistrySubject?: string          // e.g. 'orders-value'
schemaRegistryVersion?: string          // e.g. '3' or 'latest'
```

No new store actions needed — `updateTopic` already handles these fields.

### New hook — `useSchemaRegistryState`

`src/modules/kafka/hooks/useSchemaRegistryState.ts`

Manages all schema registry interaction for a single topic:

```ts
const useSchemaRegistryState = (topicName: string, topicIndex: number) => {
  // reads kafkaStore.schemaRegistry for credentials
  // state: subjects, selectedSubject, versions, selectedVersion,
  //        isLoadingSubjects, isLoadingSchema, schemaError
  // actions: fetchSubjects(), selectSubject(), fetchVersions(),
  //          selectVersion(), loadSchema()
}
```

`loadSchema()`:
- Calls `POST /ui-api/kafka/schema-registry/schema`
- On success: calls `topicsStore.updateTopic({ ...topic, schemaSource: 'external', schema: { fields }, schemaRegistrySubject, schemaRegistryVersion })`
- On failure: sets `schemaError`, leaves `schemaSource: 'internal'` — user can still proceed with event-based detection

### UI changes — `TopicSelectWithEventPreview`

When `kafkaStore.schemaRegistry.enabled === true` AND a topic name has been selected, render a
"Schema Source" section below the offset selector:

```
Schema Source

  ( ) Auto-detect from events     ← default
  ( ) Load from Schema Registry

  └─ when Schema Registry is selected:

       Subject
       [ orders-value                      v ]
         orders-value    ← ranked first (contains topic name)
         orders-key      ← ranked second
         ──────────────
         analytics-value ← other subjects below
         payments-value

       Version
       [ latest                            v ]
         latest
         3 (newest)
         2
         1

       [ Load Schema ]

  └─ after successful load:
       Schema loaded — 8 fields from orders-value v3
```

**Subject ranking**: the `/subjects` route returns subjects sorted by relevance to the topic name:
1. `{topicName}-value` — top
2. `{topicName}-key` — second
3. Subjects containing `topicName` (any position) — third
4. All remaining subjects — below a visual separator

This works regardless of the naming convention used in the user's registry.

**Fallback behavior**: if subject/version loading fails after the registry itself was validated in
step 1, show an inline warning and allow the user to continue with `schemaSource: 'internal'`
(event-based detection). A momentary fetch error should not block the journey.

### New UI API routes

**`POST /ui-api/kafka/schema-registry/subjects`**
```ts
// Request
{ url: string; apiKey?: string; apiSecret?: string; topicName: string }
// Response
{ success: boolean; subjects: string[]; error?: string }
```
Calls `GET {url}/subjects`. Returns all subjects sorted by relevance to `topicName`.

**`POST /ui-api/kafka/schema-registry/versions`**
```ts
// Request
{ url: string; apiKey?: string; apiSecret?: string; subject: string }
// Response
{ success: boolean; versions: Array<{ version: number; label: string }>; error?: string }
// e.g. [{ version: 3, label: '3 (newest)' }, { version: 2, label: '2' }, ...]
```
Calls `GET {url}/subjects/{subject}/versions`. Returns versions newest-first, with `"latest"` as the
first option in the UI dropdown.

**`POST /ui-api/kafka/schema-registry/schema`**
```ts
// Request
{ url: string; apiKey?: string; apiSecret?: string; subject: string; version: string | number }
// Response
{ success: boolean; fields: Array<{ name: string; type: string }>; error?: string }
```
Calls `GET {url}/subjects/{subject}/versions/{version}`. Parses the JSON Schema payload server-side
and returns fields in the internal type format.

**Type mapping in the schema route** (JSON Schema types → internal types):

```ts
const typeMap: Record<string, string> = {
  integer: 'int',
  number:  'float',
  boolean: 'bool',
  string:  'string',
  array:   'array',
  object:  'bytes',
  null:    'string',
}
```

Nested `object` properties are flattened with dot notation, matching the existing event-based
inference behavior (e.g. `address.city`).

### Hydration

`src/store/hydration/topics.ts` — in `mapBackendTopicToStore`:

```ts
const schemaSource = topicConfig.schema_registry?.url ? 'external' : 'internal'
return {
  ...existing,
  schemaSource,
  schemaRegistryVersion: topicConfig.schema_version,
  // schemaRegistrySubject is not stored in pipeline JSON; will need re-selection on edit
}
```

---

## Phase 3 — Type Verification Step Adaptation

`src/modules/kafka/KafkaTypeVerification.tsx`

When `topic.schemaSource === 'external'`:

1. Show an information banner at the top:
   ```
   Schema loaded from Schema Registry
   Subject: orders-value · Version: 3
   Fields are read-only. To change the schema, update the subject on the Topic Selection step.
   ```

2. Pass `readOnly={true}` to `FieldTypesTable` — the prop already exists, no component changes needed

3. Hide the "Add field" row and remove/restore buttons (only relevant for manually managed schemas)

4. Change the action button label: `"Confirm Types"` → `"Confirm Schema"` when source is external

The save logic in `handleSave` is unchanged — it still calls `topicsStore.updateTopic({ ...topic, schema })`.
For external schema the fields were already set in Phase 2; this step is a review-and-confirm gate.

**No changes to step keys or the step machine.** `kafka-type-verification` is visited for both
internal and external schemas — users should review the schema regardless of its origin.

---

## Phase 4 — V3 Adapter: Pipeline JSON Generation

### Thread schema registry through `buildInternalPipelineConfig`

`src/modules/clickhouse/utils.ts` — `buildInternalPipelineConfig` already receives `kafkaStore`.
Access `kafkaStore.schemaRegistry` directly inside the function.

Add `schemaRegistry` to `InternalPipelineConfig.source` in `src/types/pipeline.ts`:

```ts
source: {
  // ...existing fields
  schemaRegistry?: {
    url: string
    apiKey: string
    apiSecret: string
  }
}
```

### V3 adapter `generate()` changes

`src/modules/pipeline-adapters/v3.ts` — replace the hard-coded empty `schema_registry`:

```ts
// Always include schema_fields regardless of schema source.
// For external schema: fields were fetched from the registry at creation time,
// so sending them is safe and avoids a registry round-trip at deploy time.
if (topic.schema?.fields) {
  topic.schema_fields = topic.schema.fields
    .filter((f: any) => !f.isRemoved)
    .map((f: any) => ({ name: f.name, type: f.userType || f.type || 'string' }))
}

// Always emit schema_registry (filled for external, empty for internal)
const reg = apiConfig.source?.schemaRegistry
topic.schema_registry = {
  url: reg?.url ?? '',
  api_key: reg?.apiKey ?? '',
  api_secret: reg?.apiSecret ?? '',  // plain string, not base64
}

// schema_version: use the registry version for external topics
if (topic.schemaSource === 'external' && topic.schemaRegistryVersion && topic.schemaRegistryVersion !== 'latest') {
  topic.schema_version = topic.schemaRegistryVersion
} else if (topic.schema_version === undefined) {
  topic.schema_version = '1'
}
```

---

## Phase 5 — Review Step

`src/modules/review/KafkaConnectionPreview.tsx`:

```tsx
{kafkaStore.schemaRegistry?.enabled && (
  <div>
    <span className="text-muted-foreground">Schema Registry:</span>{' '}
    {kafkaStore.schemaRegistry.url}
  </div>
)}
```

`src/modules/review/ReviewConfiguration.tsx` — per topic in the topics list:

```tsx
<div className="text-sm text-content-faded">
  {topic.schemaSource === 'external'
    ? `External schema: ${topic.schemaRegistrySubject ?? '—'} v${topic.schemaRegistryVersion ?? '?'}`
    : 'Auto-detected schema'}
</div>
```

---

## Phase 6 — Pipeline Page Version Selector (future, backend dependency)

Based on Pablo's clarification:

- Each topic has an independent integer version (auto-incremented by the backend when schema evolves)
- Multi-topic (join) pipelines have one version per topic, e.g. `orders:1001 · users:1002`
- `GET /pipeline/:id?schema=orders:1001&schema=users:1001` returns the config at that version combination
- Not all combinations are stored — only combinations that were actually deployed exist in the DB

**Backend prerequisite**: `GET /pipeline/:id/schema-versions` returning all valid version combinations.
This endpoint does not yet exist.

**UI work once the endpoint is available**:
- Parse `source.topics[].schema_version` from fetched pipeline JSON → show current version badge
- `SchemaVersionSelector` dropdown populated from the backend endpoint
- Selecting a version combination re-fetches `GET /pipeline/:id?schema=...` and re-renders the page

---

## Files Changed

| File | Change |
|------|--------|
| `src/store/kafka.store.ts` | Add `schemaRegistry` to store |
| `src/scheme/kafka.scheme.ts` | Add `schemaRegistry` group to Zod schema |
| `src/scheme/topics.scheme.ts` | Add `schemaSource`, `schemaRegistrySubject`, `schemaRegistryVersion` |
| `src/modules/kafka/components/KafkaConnectionFormRenderer.tsx` | Add schema registry section |
| `src/modules/kafka/KafkaConnectionContainer.tsx` | Add schema registry test to connection flow |
| `src/modules/kafka/hooks/useSchemaRegistryState.ts` | **New** — hook for schema registry interaction |
| `src/modules/kafka/components/TopicSelectWithEventPreview.tsx` | Add schema source selector |
| `src/modules/kafka/KafkaTypeVerification.tsx` | Read-only mode for external schema |
| `src/modules/review/KafkaConnectionPreview.tsx` | Show schema registry URL |
| `src/modules/review/ReviewConfiguration.tsx` | Show schema source per topic |
| `src/modules/pipeline-adapters/v3.ts` | Populate `schema_registry`, always emit `schema_fields` |
| `src/types/pipeline.ts` | Add `schemaRegistry` to `InternalPipelineConfig.source` |
| `src/store/hydration/kafka-connection.ts` | Hydrate schema registry from existing config |
| `src/store/hydration/topics.ts` | Hydrate `schemaSource` and `schemaRegistryVersion` |
| `src/app/ui-api/kafka/schema-registry/test-connection/route.ts` | **New** |
| `src/app/ui-api/kafka/schema-registry/subjects/route.ts` | **New** |
| `src/app/ui-api/kafka/schema-registry/versions/route.ts` | **New** |
| `src/app/ui-api/kafka/schema-registry/schema/route.ts` | **New** |

---

## Key Design Decisions

**schema_fields always provided**: Even for external schema topics, `schema_fields` is always included
in the generated JSON. The fields were fetched from the registry at creation time, making them a
reliable source. Sending them avoids a registry round-trip at deploy time and prevents failures caused
by transient registry unavailability.

**Credentials at connection level**: Schema registry URL/key/secret are stored at `kafkaStore` level
(one per Kafka cluster) rather than per-topic. All topics on the same cluster share one registry.
The V3 adapter copies these credentials into each topic's `schema_registry` object when generating
the JSON, matching the current backend structure.

**API Secret is plain text**: Unlike some other credentials in the codebase (e.g. `root_ca` which is
base64), schema registry API secret is stored and transmitted as a plain string. No encoding applied
at any layer.

**Subject naming is user-driven**: No naming convention is assumed. The UI fetches all subjects from
the registry and sorts them by relevance to the topic name. Users select the correct subject from
the list.

**Registry test is hard-blocking**: If schema registry is enabled and the connection test fails, the
user cannot advance past the Kafka Connection step. This mirrors the Kafka connection test behavior
and prevents creating pipelines against an unreachable registry.
