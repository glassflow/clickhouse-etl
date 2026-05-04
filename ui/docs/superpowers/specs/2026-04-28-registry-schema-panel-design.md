# Registry Schema Panel — Design Spec

**Date:** 2026-04-28  
**Branch:** `ui-support-external-schema-evolution`  
**Scope:** Pipeline creation journey only (editing/post-deployment deferred)

---

## Problem

The current schema registry flow requires users to manually choose a "schema source" via radio buttons, then explicitly click "Load Schema" after picking a subject and version. This is friction-heavy and doesn't leverage auto-detection. The goal is to make schema selection feel automatic when possible, and always offer a clean manual fallback — without removing the event-based inference path.

---

## Solution

Replace `SchemaSourceSelector.tsx` with a new `RegistrySchemaPanel.tsx` component. The panel:

- Only renders when `kafkaStore.schemaRegistry?.enabled` is true (gating unchanged)
- Only renders content when a topic has been selected
- Runs auto-detection in the background and prompts the user if a schema is found
- Always shows a subject/version dropdown for manual selection
- Always offers "Continue with event-based detection" as an explicit opt-out

---

## Component Structure

**Removed:** `src/modules/kafka/components/SchemaSourceSelector.tsx`

**New:** `src/modules/kafka/components/RegistrySchemaPanel.tsx`

**Modified:** `src/modules/kafka/hooks/useSchemaRegistryState.ts`
- Remove on-mount subject fetch (was triggered by radio button mode switch)
- Add trigger: fetch subjects when `topicName` changes from empty → non-empty
- Remove `pendingSchemaSource` and radio-button-related state

**Unchanged:**
- `KafkaTopicSelector.tsx` — replace `SchemaSourceSelector` import with `RegistrySchemaPanel`; gating condition (`kafkaStore.schemaRegistry?.enabled`) stays identical
- All downstream consumers (`KafkaTypeVerification`, `useClickhouseMapperEventFields`, V3 adapter)

---

## Visual States

### State 1: No topic selected
Panel renders nothing.

### State 2: Topic selected — loading / idle
Subjects fetch kicks off when `topicName` transitions from empty to a value.  
Auto-resolution also starts in parallel if a raw event with bytes is already available.

```
Subject   [Loading subjects…  ▾]
Version   [—                  ▾]
```

### State 3: Auto-detection prompt available

```
┌──────────────────────────────────────────────────────┐
│  Schema detected in event                            │
│  orders-value · Version 3 · 23 fields                │
│  [Use this schema]    [Ignore]                       │
└──────────────────────────────────────────────────────┘

Subject   [orders-value   ▾]   ← pre-selected
Version   [3 (latest)     ▾]
```

- **Use this schema** → loads schema from registry, advances to State 4
- **Ignore** → dismisses banner; dropdown stays editable; topic proceeds with event-based inference

### State 4: Schema applied

```
✓ Schema applied — 23 fields from orders-value v.3

                         [Continue with event-based detection]
```

"Continue with event-based detection" clears the applied schema and returns to State 2.

---

## Behavior Rules

| Trigger | Action |
|---|---|
| `topicName` changes empty → value | Fetch subjects; start auto-resolution if raw bytes available |
| New event with raw bytes arrives | Attempt auto-resolution if not already attempted for this event |
| User presses "Use this schema" | Load schema fields from registry; apply to store (State 4) |
| User presses "Ignore" | Dismiss banner; no schema applied; event-based inference continues |
| User picks subject from dropdown | Fetch versions for that subject; clear any previously applied schema |
| User picks version from dropdown (subject already set) | Auto-load schema from registry immediately (no separate "Load Schema" button) |
| User presses "Continue with event-based detection" | Clear schema from store; return to State 2 |

> The "Load Schema" button is removed. Selecting a subject + version triggers load automatically.

---

## Store Writes

**Schema applied (prompt or manual):**
```ts
topicsStore.updateTopic({
  ...topic,
  schemaSource: 'registry_resolved_from_event' | 'external',
  schemaRegistrySubject: selectedSubject,
  schemaRegistryVersion: resolvedVersion,   // always a number string, never 'latest'
  schema: {
    fields: data.fields.map(f => ({ name: f.name, type: f.type, userType: f.type }))
  },
})
```

**Schema cleared (opt-out):**
```ts
topicsStore.updateTopic({
  ...topic,
  schemaSource: 'internal',
  schemaRegistrySubject: undefined,
  schemaRegistryVersion: undefined,
  schema: { fields: [] },
})
```

---

## Downstream Impact

No downstream changes required. All consumers already read from the same store fields:

| Consumer | Reads | Behavior |
|---|---|---|
| `KafkaTypeVerification` | `isRegistrySchema(topic.schemaSource)` | Goes read-only when external schema applied |
| `useClickhouseMapperEventFields` | `topic.schemaSource`, `topic.schema.fields` | Uses registry fields instead of event-extracted fields |
| V3 adapter `generate()` | `topic.schemaSource`, `topic.schema`, `topic.schemaRegistrySubject/Version` | Emits `schema_registry`, `schema_fields`, `schema_version` |

---

## Out of Scope

- Post-deployment schema version switching (Phase 6 / `SchemaBindingsSection`) — deferred
- Schema validation against ClickHouse column types
- AVRO / Protobuf format support (backend stubs exist, UI deferred)
- Error retry logic for transient registry failures
