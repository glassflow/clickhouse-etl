# OTLP Source UI Support — Design Spec

**Date:** 2026-04-10
**Linear Issue:** ETL-821
**Approach:** Source-Aware Journey Builder (Approach A)
**Status:** Draft

---

## Overview

Add OTLP (OpenTelemetry) as an alternative data source in the GlassFlow pipeline creation UI. The backend already supports OTLP pipelines — the Go API accepts `source.type` values of `otlp.logs`, `otlp.traces`, and `otlp.metrics` alongside `kafka`. This spec covers the UI changes needed to expose that capability.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source selection location | Home page, before wizard | Matches existing pattern of setting core params (topicCount) before wizard entry |
| Deduplication fields | Dropdown from predefined OTLP schema | Fields are known and fixed per signal type — no free-text needed |
| Multi-topic / join | Not supported for OTLP | Backend rejects join for OTLP; single source only |
| Filter + transformation | Included | Backend supports both source-agnostically |
| Receiver availability | Always show OTLP option | Fail with clear error at pipeline creation if receiver not deployed |
| ClickHouse mapper | Auto-suggest mappings | OTLP fields are standardized; pre-populate to reduce friction |
| Pipeline resources | Hide ingestor for OTLP | OTLP receiver is a shared service, not per-pipeline |

## Architecture

### Source Type Model

A new `SourceType` enum is added to `src/config/constants.ts`:

```typescript
export enum SourceType {
  KAFKA = 'kafka',
  OTLP_LOGS = 'otlp.logs',
  OTLP_TRACES = 'otlp.traces',
  OTLP_METRICS = 'otlp.metrics',
}
```

One new step key is added to `StepKeys`:

```typescript
OTLP_SIGNAL_TYPE = 'otlp-signal-type'
```

Deduplication is embedded within the `OTLP_SIGNAL_TYPE` step (not a separate wizard step) since the OTLP flow is simpler and doesn't warrant a dedicated dedup step.

`sourceType` is added to `CoreStoreProps` (default: `SourceType.KAFKA`) and set on the home page before wizard entry.

### OTLP Store Slice

New file: `src/store/otlp.store.ts`

```typescript
interface OtlpStore {
  signalType: 'otlp.logs' | 'otlp.traces' | 'otlp.metrics' | null
  sourceId: string
  deduplication: {
    enabled: boolean
    id_field: string
    id_field_type: string
    time_window: string
  }
  schemaFields: OtlpSchemaField[]
  resetOtlpStore: () => void
  setSignalType: (type: string) => void
  setDeduplication: (config: Partial<OtlpDeduplicationConfig>) => void
  resetValidation: () => void
  // standard validation state
  isValidated: boolean
  isInvalidated: boolean
  markAsValidated: () => void
  markAsInvalidated: (reason?: string) => void
}
```

Composed into the root Store in `src/store/index.ts` alongside existing slices. Reset in `resetAllPipelineState()` and `clearAllUserData()`.

### Home Page Flow

Current:
```
Home → [Single-Topic | Multi-Topic] → CreatePipelineModal → /pipelines/create
```

New:
```
Home → [Kafka | OTLP] → (Kafka: [Single-Topic | Multi-Topic]) | (OTLP: [Logs | Traces | Metrics]) → CreatePipelineModal → /pipelines/create
```

Changes to `HomePageClient.tsx`:
- Add a "Choose your data source" section with two selectable `Card` components (Kafka, OTLP)
- When Kafka is selected, show the existing topic count cards
- When OTLP is selected, show three signal type cards (Logs, Traces, Metrics)
- For OTLP, `topicCount` is set to 1 automatically (single source, no join)
- `sourceType` is set via `coreStore.setSourceType()` before navigating to wizard

### OTLP Wizard Journey

New function in `src/modules/create/utils.ts`:

```typescript
export const getOtlpJourney = (): StepKeys[] => {
  const steps: StepKeys[] = [
    StepKeys.OTLP_SIGNAL_TYPE,
  ]

  if (isFiltersEnabled()) {
    steps.push(StepKeys.FILTER_CONFIGURATOR)
  }
  if (isTransformationsEnabled()) {
    steps.push(StepKeys.TRANSFORMATION_CONFIGURATOR)
  }

  steps.push(
    StepKeys.CLICKHOUSE_CONNECTION,
    StepKeys.CLICKHOUSE_MAPPER,
    StepKeys.PIPELINE_RESOURCES,
  )

  if (isPreviewModeEnabled()) {
    steps.push(StepKeys.REVIEW_CONFIGURATION)
  }

  return steps
}
```

The wizard entry function becomes source-type-aware:

```typescript
export function getWizardJourneyInstances(
  topicCount: number | undefined,
  sourceType: SourceType,
): StepInstance[] {
  if (sourceType !== SourceType.KAFKA) {
    return getOtlpJourneyInstances()
  }
  return topicCount === 1
    ? getSingleTopicJourneyInstances()
    : getTwoTopicJourneyInstances()
}
```

Sidebar for OTLP:
```
● OTLP Source
● Filter              (if feature-flag enabled)
● Transform           (if feature-flag enabled)
● ClickHouse Connection
● Mapping
● Pipeline Resources
● Review & Deploy     (if preview mode enabled)
```

### OTLP Components

New module: `src/modules/otlp/`

```
src/modules/otlp/
├── constants.ts                    # Predefined schema fields per signal type
├── components/
│   ├── OtlpSignalTypeStep.tsx      # Combined: signal type + schema preview + dedup
│   └── OtlpSchemaPreview.tsx       # Read-only schema field list
```

**`OtlpSignalTypeStep`** — the single OTLP-specific wizard step. Contains three sections:

1. **Signal type selector** — three selectable cards (Logs, Traces, Metrics). Pre-selected from home page, changeable here. Selecting a type populates `otlpStore.schemaFields`.

2. **Schema preview** — read-only list of predefined fields for the selected signal type. Provides visibility into the data shape for downstream steps.

3. **Deduplication** (collapsible) — toggle, field dropdown (from predefined schema), field type selector, time window input. Same UX pattern as existing Kafka dedup.

**Predefined schema fields** in `src/modules/otlp/constants.ts`, matching the Go backend's models:

- **Logs** (13 fields): timestamp, observed_timestamp, severity_number, severity_text, body, trace_id, span_id, flags, resource_attributes, scope_name, scope_version, scope_attributes, log_attributes
- **Traces** (19 fields): trace_id, span_id, parent_span_id, name, kind, start_time, end_time, duration_ns, status_code, status_message, resource_attributes, scope_name, scope_version, scope_attributes, span_attributes, events, links, trace_state, flags
- **Metrics** (19 fields): metric_name, metric_description, metric_unit, metric_type, value_double, value_int, sum, count, min, max, quantile_values, bucket_counts, explicit_bounds, start_time, timestamp, is_monotonic, aggregation_temporality, resource_attributes, metric_attributes

### Shared Step Adaptations

Shared steps gain lightweight `sourceType`-aware branching via a helper:

```typescript
// src/utils/schema-fields.ts
function getSourceSchemaFields(sourceType: SourceType, store: Store): SchemaField[] {
  if (sourceType !== SourceType.KAFKA) {
    return store.otlpStore.schemaFields
  }
  return store.topicsStore.selectedTopicSchema
}
```

| Step | OTLP Adaptation |
|------|----------------|
| **FilterConfigurator** | Use `getSourceSchemaFields()` for field list |
| **TransformationConfigurator** | Same schema field source swap |
| **ClickhouseMapper** | Auto-suggest mappings when sourceType is OTLP |
| **PipelineResourcesConfigurator** | Hide ingestor section when sourceType is OTLP |
| **ReviewConfiguration** | Render OTLP source config instead of Kafka section; call `generateOtlpApiConfig()` |

### Pipeline Types

`src/types/pipeline.ts` additions:

```typescript
interface OtlpSourceConfig {
  id: string
  deduplication: {
    enabled: boolean
    id_field: string
    id_field_type: string
    time_window: string
  }
}
```

The existing `Pipeline.source` type is extended to support both Kafka and OTLP shapes. The `type` field discriminates: `'kafka'` means `connection_params` and `topics` are present; `'otlp.*'` means `id` and `deduplication` are present.

### API Submission

A new `generateOtlpApiConfig()` function assembles the OTLP pipeline payload:

```typescript
function generateOtlpApiConfig(store: Store): Partial<Pipeline> {
  return {
    pipeline_id: store.coreStore.pipelineId,
    name: store.coreStore.pipelineName,
    source: {
      type: store.otlpStore.signalType,
      id: store.otlpStore.sourceId,
      deduplication: store.otlpStore.deduplication,
    },
    join: { type: '', enabled: false, sources: [] },
    filter: store.filterStore.enabled
      ? { enabled: true, expression: store.filterStore.expression }
      : undefined,
    stateless_transformation: store.transformationStore.enabled
      ? { /* transform config */ }
      : undefined,
    sink: { /* same ClickHouse config as Kafka */ },
    pipeline_resources: {
      // No ingestor for OTLP
      transform: store.resourcesStore.transform,
      sink: store.resourcesStore.sink,
    },
  }
}
```

The review step calls `generateOtlpApiConfig()` when `sourceType` is OTLP, `generateApiConfig()` when Kafka. The existing API route handler (`src/app/ui-api/pipeline/route.ts`) forwards the payload unchanged — the Go backend handles both shapes.

### Hydration (Edit/View Mode)

New file: `src/store/hydration/otlp-source.ts`

When loading an existing pipeline with `source.type` starting with `otlp.`:
- `sourceType` on CoreStore is set to the OTLP variant
- `otlpStore` is hydrated with `signalType`, `sourceId`, `deduplication`, and the predefined `schemaFields`
- Kafka stores are left empty

The `hydrateSection` method in `core.ts` gains an `'otlp'` case and branches in `'all'` based on source type.

### Wizard Orchestrator Changes

`PipelineWizard.tsx`:
- Read `sourceType` from `coreStore` alongside `topicCount`
- Guard: if `sourceType` is OTLP, auto-set `topicCount` to 1
- Guard: if `sourceType` is not set, redirect to home
- Pass `sourceType` to `getWizardJourneyInstances()` and `getSidebarStepsFromInstances()`
- `componentsMap` gains: `[StepKeys.OTLP_SIGNAL_TYPE]: OtlpSignalTypeStep`

### Analytics

Extend `useJourneyAnalytics` to track:
- `source_type_selected` event on home page
- OTLP signal type selection
- OTLP dedup configuration
- Existing Kafka analytics untouched

---

## File Inventory

### New Files

| File | Purpose |
|------|---------|
| `src/modules/otlp/constants.ts` | Predefined schema fields for logs, traces, metrics |
| `src/modules/otlp/components/OtlpSignalTypeStep.tsx` | Combined signal type + schema preview + dedup step |
| `src/modules/otlp/components/OtlpSchemaPreview.tsx` | Read-only schema field list |
| `src/store/otlp.store.ts` | OtlpSlice |
| `src/store/hydration/otlp-source.ts` | Hydrate otlpStore from pipeline config |
| `src/utils/schema-fields.ts` | Source-type-aware schema field helper |

### Modified Files

| File | Change |
|------|--------|
| `src/config/constants.ts` | Add `SourceType` enum, OTLP step keys, `stepsMetadata` entries |
| `src/store/core.ts` | Add `sourceType` to props, `setSourceType()` action, reset in `enterCreateMode()` |
| `src/store/index.ts` | Compose `OtlpSlice`, reset in `resetAllPipelineState()` |
| `src/types/pipeline.ts` | Add `OtlpSourceConfig`, extend `Pipeline.source` |
| `src/components/home/HomePageClient.tsx` | Source selection section, conditional topic count vs signal type |
| `src/modules/create/utils.ts` | Add `getOtlpJourney()`, `getOtlpJourneyInstances()`, update journey builder signature, add OTLP to `componentsMap` and `sidebarStepConfig` |
| `src/modules/create/PipelineWizard.tsx` | Read `sourceType`, pass to journey builder, OTLP guard |
| `src/modules/clickhouse/ClickhouseMapper.tsx` | Auto-suggest mappings for OTLP |
| `src/modules/resources/PipelineResourcesConfigurator.tsx` | Hide ingestor section for OTLP |
| `src/modules/review/ReviewConfiguration.tsx` | Render OTLP source section, call `generateOtlpApiConfig()` |
| `src/modules/filter/FilterConfigurator.tsx` | Use `getSourceSchemaFields()` |
| `src/modules/transformation/TransformationConfigurator.tsx` | Use `getSourceSchemaFields()` |
| `src/store/core.ts` (hydrateSection) | Add `'otlp'` case, branch `'all'` on source type |
| `src/hooks/useJourneyAnalytics.ts` | Add OTLP tracking events |

### Untouched

- All Kafka modules (`src/modules/kafka/`)
- Kafka store slices
- ClickHouse connection step (source-agnostic)
- API route handler (`src/app/ui-api/pipeline/route.ts`)
