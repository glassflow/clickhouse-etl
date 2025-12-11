# State Management Architecture

## Overview

Zustand with slice-based composition. Each domain slice owns its state/actions; core slice manages pipeline-level concerns (mode, dirty state, hydration, history).

## Store Composition (`src/store/index.ts`)

- Composed slices: kafka, clickhouse-connection, clickhouse-destination, topics, deduplication, join, filter, steps, core.
- Global helpers: `resetAllPipelineState`, `resetForNewPipeline`, `resetFormValidationStates`, `clearAllUserData`.

## Core Slice (`src/store/core.ts`)

- Pipeline metadata: `pipelineId`, `pipelineName`, `pipelineVersion`.
- Mode: `create | edit | view`.
- Dirty tracking: `isDirty`, `baseConfig`, `lastSavedConfig`, `saveHistory`.
- Operations: `topicCount`, `operationsSelected`, `outboundEventPreview`.
- Hydration: `hydrateFromConfig(config)`, `hydrateSection(section, config)`.
- Discard/reset: `discardChanges`, `discardSection`, `discardSections`, `discardToLastSaved`, `resetToInitial`, `enterCreateMode`, `enterEditMode`, `enterViewMode`.

## Domain Slices (examples)

- `kafka.store.ts`: connection params, validation state, reset helpers.
- `topics.store.ts`: topics list/selection, validation.
- `clickhouse-connection.store.ts`: connection params, database metadata.
- `clickhouse-destination.store.ts`: destination table/fields.
- `deduplication.store.ts`: dedup configs keyed by topic index.
- `join.store.ts`: join configuration state.
- `filter.store.ts`: filter expression tree state.
- `steps.store.ts`: wizard step management.

## Hydration (`src/store/hydration/*`)

Section-based hydration enabling partial discards:

- `kafka-connection.ts`, `topics.ts`, `clickhouse-connection.ts`, `clickhouse-destination.ts`, `join-configuration.ts`, `filter.ts`, `pipeline-config.ts`.
- Use `coreStore.hydrateSection('kafka' | 'topics' | 'deduplication' | 'join' | 'filter' | 'clickhouse-connection' | 'clickhouse-destination' | 'all', config)`.

## Mode Semantics

- Create: fresh pipeline, no base config, all editable.
- Edit: base config set; track dirty vs base/lastSaved.
- View: read-only; forms should respect `readOnly` flag from mode.

## Dirty Tracking

- Mark dirty on user changes: `coreStore.markAsDirty()`.
- Clean on save: `coreStore.markAsClean()` and update `lastSavedConfig`.
- Compare vs base: `coreStore.isDirtyComparedToBase()`.

## Reset Patterns

- Full reset for new pipeline: `resetAllPipelineState(topicCount, true)` or `resetForNewPipeline`.
- Partial reset: `resetFormValidationStates` to clear validation without losing data.
- Nuclear option: `clearAllUserData()` clears all slices, cookies, history.

## Usage Pattern

```typescript
const { kafkaStore, coreStore } = useStore()

// read state
const { connection } = kafkaStore
const { mode, isDirty } = coreStore

// write state
kafkaStore.setConnection(nextConnection)
coreStore.setPipelineId('abc')
coreStore.markAsDirty()
```

## Best Practices

- Keep domain logic in domain slices; avoid cross-slice mutations.
- Always use actions; avoid direct state mutation.
- Prefer immutable updates; shallow copy nested objects when changing.
- Respect mode and read-only when mutating from UI.
- Hydrate via helpers; avoid ad-hoc store writes on load.
- Track dirty state only on user-facing changes; reset on successful save/hydration.

## Related Docs

- Architecture Overview: ./ARCHITECTURE_OVERVIEW.md
- Module Architecture: ./MODULE_ARCHITECTURE.md
- Form Architecture: ./FORM_ARCHITECTURE.md
