# OTLP Source UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OTLP (OpenTelemetry) as an alternative data source in the pipeline creation UI, alongside the existing Kafka source.

**Architecture:** Source-Aware Journey Builder — a `sourceType` field on CoreStore drives which wizard journey loads. OTLP-specific steps live in `src/modules/otlp/`, shared steps (ClickHouse, filter, transform, resources) gain lightweight `sourceType`-aware branching. Kafka code is untouched.

**Tech Stack:** Next.js 16, Zustand (slice pattern), TypeScript, Tailwind + CSS tokens, Radix UI primitives

**Spec:** `docs/superpowers/specs/2026-04-10-otlp-source-ui-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/config/source-types.ts` | `SourceType` enum and OTLP signal type helpers |
| `src/modules/otlp/constants.ts` | Predefined OTLP schema fields per signal type (mirrors Go backend) |
| `src/modules/otlp/components/OtlpSignalTypeStep.tsx` | Wizard step: signal type selector + schema preview + dedup config |
| `src/modules/otlp/components/OtlpSchemaPreview.tsx` | Read-only schema field table |
| `src/store/otlp.store.ts` | OtlpSlice: signal type, sourceId, dedup, schema fields, validation |
| `src/store/hydration/otlp-source.ts` | Hydrate otlpStore from existing pipeline config |
| `src/utils/source-schema-fields.ts` | `getSourceSchemaFields()` — source-type-aware schema field accessor |

### Modified Files

| File | Change Summary |
|------|---------------|
| `src/config/constants.ts` | Add `OTLP_SIGNAL_TYPE` to `StepKeys`, add `stepsMetadata` entry |
| `src/store/core.ts` | Add `sourceType` to props + `setSourceType()` action |
| `src/store/index.ts` | Compose `OtlpSlice`, reset in `resetAllPipelineState()` |
| `src/types/pipeline.ts` | Add `OtlpSourceConfig`, extend `Pipeline.source` type |
| `src/components/home/HomePageClient.tsx` | Source selection UI, conditional topic count vs signal type |
| `src/modules/create/utils.ts` | Add `getOtlpJourney()`, update `getWizardJourneyInstances()` signature |
| `src/modules/create/PipelineWizard.tsx` | Read `sourceType`, pass to journey builder, OTLP guard |
| `src/modules/filter/FilterConfigurator.tsx` | Use `getSourceSchemaFields()` instead of direct topicsStore read |
| `src/modules/transformation/TransformationConfigurator.tsx` | Same schema swap |
| `src/modules/resources/PipelineResourcesConfigurator.tsx` | Add `isOtlp` flag, pass to form renderer |
| `src/modules/resources/PipelineResourcesFormRenderer.tsx` | Hide ingestor section when `isOtlp` |
| `src/modules/clickhouse/ClickhouseMapper.tsx` | Auto-suggest mappings for OTLP fields |
| `src/modules/review/ReviewConfiguration.tsx` | Render OTLP source section, build OTLP payload |
| `src/store/core.ts` (hydrateSection) | Add `'otlp'` case, branch `'all'` on source type |

---

## Task 1: Add SourceType enum and OTLP constants

**Files:**
- Create: `src/config/source-types.ts`
- Create: `src/modules/otlp/constants.ts`
- Modify: `src/config/constants.ts`

- [ ] **Step 1: Create SourceType enum**

```typescript
// src/config/source-types.ts
export enum SourceType {
  KAFKA = 'kafka',
  OTLP_LOGS = 'otlp.logs',
  OTLP_TRACES = 'otlp.traces',
  OTLP_METRICS = 'otlp.metrics',
}

export function isOtlpSource(sourceType: SourceType | string): boolean {
  return sourceType === SourceType.OTLP_LOGS ||
    sourceType === SourceType.OTLP_TRACES ||
    sourceType === SourceType.OTLP_METRICS
}

export function getOtlpSignalLabel(sourceType: SourceType | string): string {
  switch (sourceType) {
    case SourceType.OTLP_LOGS: return 'Logs'
    case SourceType.OTLP_TRACES: return 'Traces'
    case SourceType.OTLP_METRICS: return 'Metrics'
    default: return ''
  }
}
```

- [ ] **Step 2: Create OTLP schema field constants**

These match the Go backend's `otlpLogsSchemaFields()`, `otlpTracesSchemaFields()`, and `otlpMetricsSchemaFields()` in `glassflow-api/internal/models/otlp.go`.

```typescript
// src/modules/otlp/constants.ts
import { SourceType } from '@/src/config/source-types'

export interface OtlpSchemaField {
  name: string
  type: string
}

export const OTLP_LOGS_FIELDS: OtlpSchemaField[] = [
  { name: 'timestamp', type: 'string' },
  { name: 'observed_timestamp', type: 'string' },
  { name: 'severity_number', type: 'uint' },
  { name: 'severity_text', type: 'string' },
  { name: 'body', type: 'string' },
  { name: 'trace_id', type: 'string' },
  { name: 'span_id', type: 'string' },
  { name: 'flags', type: 'uint' },
  { name: 'dropped_attributes_count', type: 'uint' },
  { name: 'resource_attributes', type: 'map' },
  { name: 'scope_name', type: 'string' },
  { name: 'scope_version', type: 'string' },
  { name: 'scope_attributes', type: 'map' },
  { name: 'attributes', type: 'map' },
]

export const OTLP_TRACES_FIELDS: OtlpSchemaField[] = [
  { name: 'trace_id', type: 'string' },
  { name: 'span_id', type: 'string' },
  { name: 'parent_span_id', type: 'string' },
  { name: 'trace_state', type: 'string' },
  { name: 'flags', type: 'uint' },
  { name: 'name', type: 'string' },
  { name: 'kind', type: 'string' },
  { name: 'start_timestamp', type: 'string' },
  { name: 'end_timestamp', type: 'string' },
  { name: 'duration_ns', type: 'uint' },
  { name: 'status_code', type: 'string' },
  { name: 'status_message', type: 'string' },
  { name: 'dropped_attributes_count', type: 'uint' },
  { name: 'dropped_events_count', type: 'uint' },
  { name: 'dropped_links_count', type: 'uint' },
  { name: 'events', type: 'array' },
  { name: 'links', type: 'array' },
  { name: 'resource_attributes', type: 'map' },
  { name: 'scope_name', type: 'string' },
  { name: 'scope_version', type: 'string' },
  { name: 'scope_attributes', type: 'map' },
  { name: 'attributes', type: 'map' },
]

export const OTLP_METRICS_FIELDS: OtlpSchemaField[] = [
  { name: 'timestamp', type: 'string' },
  { name: 'start_timestamp', type: 'string' },
  { name: 'metric_name', type: 'string' },
  { name: 'metric_description', type: 'string' },
  { name: 'metric_unit', type: 'string' },
  { name: 'metric_type', type: 'string' },
  { name: 'aggregation_temporality', type: 'string' },
  { name: 'is_monotonic', type: 'bool' },
  { name: 'flags', type: 'uint' },
  { name: 'value_double', type: 'float' },
  { name: 'value_int', type: 'int' },
  { name: 'count', type: 'uint' },
  { name: 'sum', type: 'float' },
  { name: 'min', type: 'float' },
  { name: 'max', type: 'float' },
  { name: 'bucket_counts', type: 'array' },
  { name: 'explicit_bounds', type: 'array' },
  { name: 'resource', type: 'map' },
  { name: 'scope_name', type: 'string' },
  { name: 'scope_version', type: 'string' },
  { name: 'scope_attributes', type: 'map' },
  { name: 'attributes', type: 'map' },
]

export function getOtlpFieldsForSignalType(sourceType: SourceType | string): OtlpSchemaField[] {
  switch (sourceType) {
    case SourceType.OTLP_LOGS: return OTLP_LOGS_FIELDS
    case SourceType.OTLP_TRACES: return OTLP_TRACES_FIELDS
    case SourceType.OTLP_METRICS: return OTLP_METRICS_FIELDS
    default: return []
  }
}
```

- [ ] **Step 3: Add OTLP step key and metadata to constants**

In `src/config/constants.ts`, add to the `StepKeys` enum (after `DEPLOY_PIPELINE`):

```typescript
OTLP_SIGNAL_TYPE = 'otlp-signal-type',
```

Add to the `stepsMetadata` object:

```typescript
[StepKeys.OTLP_SIGNAL_TYPE]: {
  key: StepKeys.OTLP_SIGNAL_TYPE,
  title: 'OTLP Source',
  description: 'Select your OpenTelemetry signal type and configure deduplication.',
  formTitle: 'OTLP Source Configuration',
  formDescription: 'Choose the type of OpenTelemetry data to ingest and optionally configure deduplication.',
},
```

- [ ] **Step 4: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds (new files are not imported anywhere yet, so no impact)

- [ ] **Step 5: Commit**

```bash
git add src/config/source-types.ts src/modules/otlp/constants.ts src/config/constants.ts
git commit -m "feat: add SourceType enum and OTLP schema field constants"
```

---

## Task 2: Create OtlpSlice store

**Files:**
- Create: `src/store/otlp.store.ts`
- Modify: `src/store/index.ts`

- [ ] **Step 1: Create OtlpSlice**

```typescript
// src/store/otlp.store.ts
import { StateCreator } from 'zustand'
import { SourceType } from '@/src/config/source-types'
import { getOtlpFieldsForSignalType, type OtlpSchemaField } from '@/src/modules/otlp/constants'
import {
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
  ValidationState,
  ValidationMethods,
} from '@/src/types/validation'

export interface OtlpDeduplicationConfig {
  enabled: boolean
  id_field: string
  id_field_type: string
  time_window: string
}

export interface OtlpStoreProps {
  signalType: SourceType | null
  sourceId: string
  deduplication: OtlpDeduplicationConfig
  schemaFields: OtlpSchemaField[]
  validation: ValidationState
}

export interface OtlpStore extends OtlpStoreProps, ValidationMethods {
  setSignalType: (type: SourceType) => void
  setSourceId: (id: string) => void
  setDeduplication: (config: Partial<OtlpDeduplicationConfig>) => void
  skipDeduplication: () => void
  resetOtlpStore: () => void
}

export interface OtlpSlice {
  otlpStore: OtlpStore
}

const initialDeduplication: OtlpDeduplicationConfig = {
  enabled: false,
  id_field: '',
  id_field_type: 'string',
  time_window: '5m',
}

export const initialOtlpStore: OtlpStoreProps = {
  signalType: null,
  sourceId: '',
  deduplication: { ...initialDeduplication },
  schemaFields: [],
  validation: createInitialValidation(),
}

export const createOtlpSlice: StateCreator<OtlpSlice> = (set, get) => ({
  otlpStore: {
    ...initialOtlpStore,

    setSignalType: (type: SourceType) =>
      set((state) => ({
        otlpStore: {
          ...state.otlpStore,
          signalType: type,
          schemaFields: getOtlpFieldsForSignalType(type),
          // Reset deduplication when signal type changes (field list changes)
          deduplication: { ...initialDeduplication },
          validation: createInitialValidation(),
        },
      })),

    setSourceId: (id: string) =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, sourceId: id },
      })),

    setDeduplication: (config: Partial<OtlpDeduplicationConfig>) =>
      set((state) => ({
        otlpStore: {
          ...state.otlpStore,
          deduplication: { ...state.otlpStore.deduplication, ...config },
        },
      })),

    skipDeduplication: () =>
      set((state) => ({
        otlpStore: {
          ...state.otlpStore,
          deduplication: { ...initialDeduplication },
          validation: createValidValidation(),
        },
      })),

    resetOtlpStore: () =>
      set((state) => ({
        otlpStore: {
          ...state.otlpStore,
          ...initialOtlpStore,
        },
      })),

    markAsValid: () =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, validation: createValidValidation() },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, validation: createInvalidatedValidation(invalidatedBy) },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, validation: createInitialValidation() },
      })),

    resetValidation: () =>
      set((state) => ({
        otlpStore: { ...state.otlpStore, validation: createInitialValidation() },
      })),
  },
})
```

- [ ] **Step 2: Compose OtlpSlice into root Store**

In `src/store/index.ts`, add the import:

```typescript
import { createOtlpSlice, OtlpSlice } from './otlp.store'
```

Add `OtlpSlice` to the `Store` interface (after `ResourcesSlice`):

```typescript
interface Store
  extends KafkaSlice,
    // ... existing slices ...
    ResourcesSlice,
    OtlpSlice {
```

Add the slice creation inside the `devtools` callback (after `createResourcesSlice`):

```typescript
...createOtlpSlice(set, get, store),
```

Add reset in `resetAllPipelineState` (inside the `if (force || ...)` block, after `state.resourcesStore.resetResources()`):

```typescript
state.otlpStore.resetOtlpStore()
```

Add reset in `clearAllUserData` (after `state.resourcesStore.resetResources()`):

```typescript
state.otlpStore.resetOtlpStore()
```

- [ ] **Step 3: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/store/otlp.store.ts src/store/index.ts
git commit -m "feat: add OtlpSlice to Zustand store"
```

---

## Task 3: Add sourceType to CoreStore

**Files:**
- Modify: `src/store/core.ts`
- Modify: `src/types/pipeline.ts`

- [ ] **Step 1: Add sourceType to CoreStoreProps**

In `src/store/core.ts`, add to `CoreStoreProps` (after `topicCount`):

```typescript
sourceType: string // 'kafka' | 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'
```

Add to `CoreStore` interface (after `setTopicCount`):

```typescript
setSourceType: (sourceType: string) => void
```

Add to `initialCoreStore`:

```typescript
sourceType: 'kafka', // Default to Kafka for backward compatibility
```

- [ ] **Step 2: Implement setSourceType action**

In the `createCoreSlice` function body, add after `setTopicCount`:

```typescript
setSourceType: (sourceType: string) =>
  set((state) => ({
    coreStore: { ...state.coreStore, sourceType },
  })),
```

- [ ] **Step 3: Reset sourceType in enterCreateMode**

In the `enterCreateMode` method, the `set` call spreads `...initialCoreStore` which already includes `sourceType: 'kafka'`. No additional change needed — this is already covered.

- [ ] **Step 4: Extend Pipeline.source type**

In `src/types/pipeline.ts`, update the `Pipeline` interface's `source` property. Change:

```typescript
source: {
  type: string
  provider: string
  connection_params: {
```

To:

```typescript
source: {
  type: string
  provider?: string
  // OTLP-specific fields (present when type starts with 'otlp.')
  id?: string
  // Kafka-specific fields (present when type === 'kafka')
  connection_params?: {
```

Also change `topics` from required to optional:

```typescript
topics?: Array<{
```

This makes the source type a discriminated union where `type` determines which fields are present.

- [ ] **Step 5: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`

There may be compilation errors where code accesses `source.connection_params` or `source.topics` without optional chaining. Fix any by adding `?.` where needed. The key files to check:
- `src/store/core.ts` `determineOperationType` — already uses `pipeline?.source?.topics`
- `src/store/hydration/` files — already use optional chaining
- `src/modules/review/ReviewConfiguration.tsx` — check topic rendering

- [ ] **Step 6: Commit**

```bash
git add src/store/core.ts src/types/pipeline.ts
git commit -m "feat: add sourceType to CoreStore and extend Pipeline source type"
```

---

## Task 4: Create source schema fields helper

**Files:**
- Create: `src/utils/source-schema-fields.ts`

- [ ] **Step 1: Create the helper**

```typescript
// src/utils/source-schema-fields.ts
import { isOtlpSource } from '@/src/config/source-types'

interface SchemaField {
  name: string
  type: string
}

/**
 * Get schema fields based on source type.
 * For OTLP: returns predefined fields from otlpStore.
 * For Kafka: returns fields from the first topic's schema or selected event.
 */
export function getSourceSchemaFields(
  sourceType: string,
  otlpSchemaFields: SchemaField[],
  topicSchemaFields: SchemaField[] | undefined,
  topicEvent: Record<string, unknown> | null,
): SchemaField[] {
  if (isOtlpSource(sourceType)) {
    return otlpSchemaFields
  }

  // Kafka path: schema fields from type verification step
  if (topicSchemaFields && topicSchemaFields.length > 0) {
    return topicSchemaFields
      .filter((f: any) => !f.isRemoved)
      .map((f: any) => ({
        name: f.name,
        type: f.userType || f.type || 'string',
      }))
  }

  // Kafka fallback: extract from event
  if (topicEvent) {
    const fields: SchemaField[] = []
    const extractFields = (obj: Record<string, unknown>, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fieldName = prefix ? `${prefix}.${key}` : key
        let fieldType = 'string'
        if (typeof value === 'number') {
          fieldType = Number.isInteger(value) ? 'int' : 'float64'
        } else if (typeof value === 'boolean') {
          fieldType = 'bool'
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extractFields(value as Record<string, unknown>, fieldName)
          continue
        }
        fields.push({ name: fieldName, type: fieldType })
      }
    }
    extractFields(topicEvent)
    return fields
  }

  return []
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/source-schema-fields.ts
git commit -m "feat: add source-type-aware schema fields helper"
```

---

## Task 5: Create OTLP wizard step components

**Files:**
- Create: `src/modules/otlp/components/OtlpSchemaPreview.tsx`
- Create: `src/modules/otlp/components/OtlpSignalTypeStep.tsx`

- [ ] **Step 1: Create OtlpSchemaPreview component**

```typescript
// src/modules/otlp/components/OtlpSchemaPreview.tsx
'use client'

import React from 'react'
import type { OtlpSchemaField } from '@/src/modules/otlp/constants'

interface OtlpSchemaPreviewProps {
  fields: OtlpSchemaField[]
  signalLabel: string
}

export function OtlpSchemaPreview({ fields, signalLabel }: OtlpSchemaPreviewProps) {
  if (fields.length === 0) return null

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">
        {signalLabel} Schema ({fields.length} fields)
      </h4>
      <div className="rounded-lg border border-[var(--color-border-neutral-faded)] bg-[var(--color-background-elevation-raised)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-neutral-faded)]">
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-foreground-neutral-faded)] uppercase tracking-wider">
                Field Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-foreground-neutral-faded)] uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr
                key={field.name}
                className={index % 2 === 0
                  ? 'bg-[var(--color-background-elevation-raised)]'
                  : 'bg-[var(--color-background-elevation-base)]'}
              >
                <td className="px-4 py-1.5 font-mono text-xs text-[var(--color-foreground-neutral)]">
                  {field.name}
                </td>
                <td className="px-4 py-1.5 text-xs text-[var(--color-foreground-neutral-faded)]">
                  {field.type}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create OtlpSignalTypeStep component**

```typescript
// src/modules/otlp/components/OtlpSignalTypeStep.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '@/src/store'
import { SourceType, getOtlpSignalLabel } from '@/src/config/source-types'
import { getOtlpFieldsForSignalType } from '@/src/modules/otlp/constants'
import { OtlpSchemaPreview } from './OtlpSchemaPreview'
import { StepKeys } from '@/src/config/constants'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { cn } from '@/src/utils/common.client'
import FormActions from '@/src/components/shared/FormActions'

const SIGNAL_OPTIONS = [
  { type: SourceType.OTLP_LOGS, label: 'Logs', description: 'Ingest OpenTelemetry log records' },
  { type: SourceType.OTLP_TRACES, label: 'Traces', description: 'Ingest OpenTelemetry span/trace data' },
  { type: SourceType.OTLP_METRICS, label: 'Metrics', description: 'Ingest OpenTelemetry metric data points' },
]

const TIME_WINDOW_OPTIONS = [
  { label: '1 minute', value: '1m' },
  { label: '5 minutes', value: '5m' },
  { label: '15 minutes', value: '15m' },
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
]

export function OtlpSignalTypeStep({
  onCompleteStep,
}: {
  onCompleteStep: (stepName: string) => void
}) {
  const { coreStore, otlpStore } = useStore()
  const { sourceType } = coreStore
  const { signalType, deduplication, schemaFields, setSignalType, setDeduplication, skipDeduplication, markAsValid } = otlpStore

  const [dedupEnabled, setDedupEnabled] = useState(deduplication.enabled)

  // Initialize signal type from coreStore.sourceType if not yet set in otlpStore
  useEffect(() => {
    if (!signalType && sourceType && sourceType !== 'kafka') {
      setSignalType(sourceType as SourceType)
    }
  }, [signalType, sourceType, setSignalType])

  const currentFields = useMemo(() => {
    return signalType ? getOtlpFieldsForSignalType(signalType) : []
  }, [signalType])

  const signalLabel = signalType ? getOtlpSignalLabel(signalType) : ''

  // Dedup field options from the predefined schema
  const dedupFieldOptions = useMemo(() => {
    return currentFields
      .filter((f) => f.type === 'string' || f.type === 'uint' || f.type === 'int')
      .map((f) => ({ label: f.name, value: f.name, type: f.type }))
  }, [currentFields])

  const handleSignalTypeChange = useCallback((type: SourceType) => {
    setSignalType(type)
    coreStore.setSourceType(type)
    setDedupEnabled(false)
  }, [setSignalType, coreStore])

  const handleDedupToggle = useCallback(() => {
    const newEnabled = !dedupEnabled
    setDedupEnabled(newEnabled)
    if (!newEnabled) {
      skipDeduplication()
    } else {
      setDeduplication({ enabled: true })
    }
  }, [dedupEnabled, setDeduplication, skipDeduplication])

  const handleDedupFieldChange = useCallback((fieldName: string) => {
    const field = currentFields.find((f) => f.name === fieldName)
    setDeduplication({
      enabled: true,
      id_field: fieldName,
      id_field_type: field?.type || 'string',
    })
  }, [currentFields, setDeduplication])

  const handleDedupTimeWindowChange = useCallback((timeWindow: string) => {
    setDeduplication({ time_window: timeWindow })
  }, [setDeduplication])

  const handleContinue = useCallback(() => {
    if (!signalType) return
    markAsValid()
    onCompleteStep(StepKeys.OTLP_SIGNAL_TYPE)
  }, [signalType, markAsValid, onCompleteStep])

  return (
    <div className="flex flex-col gap-8">
      {/* Signal type selector */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">Signal Type</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SIGNAL_OPTIONS.map((option) => (
            <Card
              key={option.type}
              variant="selectable"
              className={cn('cursor-pointer', signalType === option.type && 'active')}
            >
              <button
                className="flex flex-col items-start p-4 w-full h-full text-left"
                onClick={() => handleSignalTypeChange(option.type)}
              >
                <span className="text-sm font-medium text-[var(--color-foreground-neutral)]">
                  {option.label}
                </span>
                <span className="text-xs text-[var(--color-foreground-neutral-faded)] mt-1">
                  {option.description}
                </span>
              </button>
            </Card>
          ))}
        </div>
      </div>

      {/* Schema preview */}
      {signalType && (
        <OtlpSchemaPreview fields={currentFields} signalLabel={signalLabel} />
      )}

      {/* Deduplication config (collapsible) */}
      {signalType && (
        <div className="space-y-4 rounded-lg border border-[var(--color-border-neutral-faded)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">Deduplication</h4>
              <p className="text-xs text-[var(--color-foreground-neutral-faded)] mt-0.5">
                Optionally deduplicate incoming data by a key field
              </p>
            </div>
            <button
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                dedupEnabled
                  ? 'bg-[var(--color-foreground-primary)]'
                  : 'bg-[var(--color-border-neutral-faded)]',
              )}
              onClick={handleDedupToggle}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  dedupEnabled ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>

          {dedupEnabled && (
            <div className="flex flex-col gap-4 pt-2">
              {/* Dedup key field dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--color-foreground-neutral-faded)]">
                  Deduplication Key
                </label>
                <select
                  className="w-full rounded-md border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--color-foreground-neutral)] focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]"
                  value={deduplication.id_field}
                  onChange={(e) => handleDedupFieldChange(e.target.value)}
                >
                  <option value="">Select a field...</option>
                  {dedupFieldOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Time window */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--color-foreground-neutral-faded)]">
                  Time Window
                </label>
                <select
                  className="w-full rounded-md border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--color-foreground-neutral)] focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]"
                  value={deduplication.time_window}
                  onChange={(e) => handleDedupTimeWindowChange(e.target.value)}
                >
                  {TIME_WINDOW_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Continue button */}
      <FormActions
        onSubmit={handleContinue}
        isLoading={false}
        isSuccess={false}
        disabled={!signalType}
        successText="Continue"
        loadingText="Loading..."
        regularText="Continue"
        actionType="primary"
        showLoadingIcon={false}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds (components not yet wired into wizard)

- [ ] **Step 4: Commit**

```bash
git add src/modules/otlp/components/OtlpSchemaPreview.tsx src/modules/otlp/components/OtlpSignalTypeStep.tsx
git commit -m "feat: add OTLP signal type wizard step and schema preview components"
```

---

## Task 6: Wire OTLP journey into wizard

**Files:**
- Modify: `src/modules/create/utils.ts`
- Modify: `src/modules/create/PipelineWizard.tsx`

- [ ] **Step 1: Add OTLP journey and update utils.ts**

At the top of `src/modules/create/utils.ts`, add imports:

```typescript
import { OtlpSignalTypeStep } from '../otlp/components/OtlpSignalTypeStep'
import { SourceType, isOtlpSource } from '@/src/config/source-types'
```

Add the OTLP sidebar config entry in `sidebarStepConfig` (after the `DEPLOY_PIPELINE` entry):

```typescript
[StepKeys.OTLP_SIGNAL_TYPE]: {
  title: 'OTLP Source',
  parent: null,
},
```

Add the OTLP journey function (after `getTwoTopicJourney`):

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

Add OTLP journey instances function (after `getTwoTopicJourneyInstances`):

```typescript
export function getOtlpJourneyInstances(): StepInstance[] {
  const keys = getOtlpJourney()
  return keys.map((key, index) => ({
    id: stepInstanceId(key, undefined, index),
    key,
  }))
}
```

Update `getWizardJourneyInstances` signature to accept `sourceType`:

```typescript
export function getWizardJourneyInstances(
  topicCount: number | undefined,
  sourceType?: string,
): StepInstance[] {
  if (sourceType && isOtlpSource(sourceType)) {
    return getOtlpJourneyInstances()
  }
  if (!topicCount || topicCount < 1 || topicCount > 2) {
    return []
  }
  return topicCount === 1 ? getSingleTopicJourneyInstances() : getTwoTopicJourneyInstances()
}
```

Add the OTLP component to `componentsMap`:

```typescript
[StepKeys.OTLP_SIGNAL_TYPE]: OtlpSignalTypeStep,
```

Update `getWizardJourneySteps` to accept `sourceType`:

```typescript
export const getWizardJourneySteps = (
  topicCount: number | undefined,
  sourceType?: string,
): Record<string, React.ComponentType<any>> => {
  if (sourceType && isOtlpSource(sourceType)) {
    return getJourneyComponents(getOtlpJourney())
  }
  if (!topicCount || topicCount < 1 || topicCount > 2) {
    return {}
  }
  if (topicCount === 1) {
    return getJourneyComponents(getSingleTopicJourney())
  } else {
    return getJourneyComponents(getTwoTopicJourney())
  }
}
```

Update `getSidebarStepsFromInstances` — OTLP steps are all top-level (no substep logic needed), but the function already handles this correctly since OTLP steps have `parent: null` in `sidebarStepConfig`. No change needed here.

- [ ] **Step 2: Update PipelineWizard.tsx**

In `src/modules/create/PipelineWizard.tsx`, update the store destructuring:

```typescript
const { coreStore, stepsStore, topicsStore } = useStore()
const { topicCount, sourceType } = coreStore
```

Update the redirect guard (the `useEffect` at line 27) to handle OTLP:

```typescript
useEffect(() => {
  if (isOtlpSource(sourceType)) {
    // OTLP pipelines don't need topicCount validation
    return
  }
  if (!topicCount || topicCount < 1 || topicCount > 2) {
    router.push('/')
    return
  }
}, [topicCount, sourceType, router])
```

Add the import at the top:

```typescript
import { isOtlpSource } from '@/src/config/source-types'
```

Update `currentJourney` to pass `sourceType`:

```typescript
const currentJourney = React.useMemo(
  () => getWizardJourneyInstances(topicCount, sourceType),
  [topicCount, sourceType],
)
```

Update `sidebarSteps` — it already uses `currentJourney`, but the second arg needs `topicCount` which is fine (OTLP uses topicCount=1):

```typescript
const sidebarSteps = React.useMemo(
  () => {
    if (isOtlpSource(sourceType)) {
      return getSidebarStepsFromInstances(currentJourney, 1)
    }
    return topicCount && topicCount >= 1 && topicCount <= 2
      ? getSidebarStepsFromInstances(currentJourney, topicCount)
      : []
  },
  [currentJourney, topicCount, sourceType],
)
```

Update `stepComponents`:

```typescript
const stepComponents = getWizardJourneySteps(topicCount, sourceType)
```

Add OTLP step rendering in `renderStepComponent` — add a case before the default return:

```typescript
if (stepKey === StepKeys.OTLP_SIGNAL_TYPE) {
  return <StepComponent onCompleteStep={onNext} />
}
```

- [ ] **Step 3: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/modules/create/utils.ts src/modules/create/PipelineWizard.tsx
git commit -m "feat: wire OTLP journey into wizard with source-type-aware navigation"
```

---

## Task 7: Update home page with source selection

**Files:**
- Modify: `src/components/home/HomePageClient.tsx`

- [ ] **Step 1: Add source selection state and handler**

Add imports at the top:

```typescript
import { SourceType, isOtlpSource } from '@/src/config/source-types'
```

Inside `HomePageClient`, add state (after the existing `useState` declarations around line 58):

```typescript
const [selectedSource, setSelectedSource] = useState<'kafka' | 'otlp' | null>(null)
const [selectedOtlpSignal, setSelectedOtlpSignal] = useState<SourceType | null>(null)
```

Destructure `setSourceType` from `coreStore` (update the existing destructure at line 63):

```typescript
const { setPipelineName, setPipelineId, topicCount, enterCreateMode, hydrateFromConfig, setSourceType } = coreStore
```

Add OTLP signal type click handler (after `handleTopicCountClick`):

```typescript
const handleOtlpSignalClick = (signal: SourceType) => {
  // Check platform limitations
  if ((isDocker || isLocal) && activePipelinesCount > 0) {
    setShowPipelineLimitModal(true)
    return
  }

  setSelectedOtlpSignal(signal)
  setPendingTopicCount(1) // OTLP is always single source
  setIsCreatePipelineModalVisible(true)
  setIsNavigating(false)
}
```

Update `completeTopicCountSelection` to set source type (add before the `setTimeout` router push):

```typescript
// Set source type
if (selectedSource === 'otlp' && selectedOtlpSignal) {
  setSourceType(selectedOtlpSignal)
} else {
  setSourceType(SourceType.KAFKA)
}
```

- [ ] **Step 2: Update the JSX to add source selection and conditional sections**

Replace the "Configure with wizard" section (the `<section>` starting at line 254) with the new source-aware layout:

```tsx
{/* Section 1: Choose data source */}
<section className="flex flex-col gap-3 sm:gap-4 w-full" aria-labelledby="section-source-heading">
  <h2 id="section-source-heading" className="subtitle-2 text-content text-xs sm:text-sm font-medium mb-3">
    Choose your data source
  </h2>
  <p className="subtitle-3 text-xs sm:text-sm -mt-1">
    Select the type of data source for your pipeline
  </p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
    <Card variant="selectable" className={cn(selectedSource === 'kafka' && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
      <button
        className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
        onClick={() => { setSelectedSource('kafka'); setSelectedOtlpSignal(null) }}
      >
        <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
          Kafka
        </span>
      </button>
    </Card>
    <Card variant="selectable" className={cn(selectedSource === 'otlp' && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
      <button
        className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
        onClick={() => { setSelectedSource('otlp'); setPendingTopicCount(null) }}
      >
        <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
          OpenTelemetry (OTLP)
        </span>
      </button>
    </Card>
  </div>
</section>

{/* Section 2: Kafka — topic count (shown when Kafka selected) */}
{selectedSource === 'kafka' && (
  <section className="flex flex-col gap-3 sm:gap-4 w-full animate-fadeIn" aria-labelledby="section-wizard-heading">
    <h2 id="section-wizard-heading" className="subtitle-2 text-content text-xs sm:text-sm font-medium mb-3">
      Configure with wizard
    </h2>
    <p className="subtitle-3 text-xs sm:text-sm -mt-1">
      Choose a pipeline type based on the number of streams you want to ingest
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
      <Card variant="selectable" className={cn(topicCount === 1 && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
        <button
          className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
          onClick={() => handleTopicCountClick(1)}
        >
          <Image src={IngestOnly} alt="Ingest Only" width={24} height={24} className="sm:w-9 sm:h-9" />
          <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
            Single-Topic Pipeline
          </span>
        </button>
      </Card>
      <Card variant="selectable" className={cn(topicCount === 2 && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
        <button
          className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
          onClick={() => handleTopicCountClick(2)}
        >
          <Image src={Join} alt="Join" width={24} height={24} className="sm:w-9 sm:h-9" />
          <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
            Multi-Topic Pipeline
          </span>
        </button>
      </Card>
    </div>
  </section>
)}

{/* Section 2 (alt): OTLP — signal type (shown when OTLP selected) */}
{selectedSource === 'otlp' && (
  <section className="flex flex-col gap-3 sm:gap-4 w-full animate-fadeIn" aria-labelledby="section-otlp-heading">
    <h2 id="section-otlp-heading" className="subtitle-2 text-content text-xs sm:text-sm font-medium mb-3">
      Select signal type
    </h2>
    <p className="subtitle-3 text-xs sm:text-sm -mt-1">
      Choose the type of OpenTelemetry data to ingest
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full">
      <Card variant="selectable" className={cn(selectedOtlpSignal === SourceType.OTLP_LOGS && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
        <button
          className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
          onClick={() => handleOtlpSignalClick(SourceType.OTLP_LOGS)}
        >
          <span className="text-sm sm:text-lg font-medium text-muted-foreground">Logs</span>
        </button>
      </Card>
      <Card variant="selectable" className={cn(selectedOtlpSignal === SourceType.OTLP_TRACES && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
        <button
          className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
          onClick={() => handleOtlpSignalClick(SourceType.OTLP_TRACES)}
        >
          <span className="text-sm sm:text-lg font-medium text-muted-foreground">Traces</span>
        </button>
      </Card>
      <Card variant="selectable" className={cn(selectedOtlpSignal === SourceType.OTLP_METRICS && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
        <button
          className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
          onClick={() => handleOtlpSignalClick(SourceType.OTLP_METRICS)}
        >
          <span className="text-sm sm:text-lg font-medium text-muted-foreground">Metrics</span>
        </button>
      </Card>
    </div>
  </section>
)}
```

- [ ] **Step 3: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Smoke test manually**

Run: `pnpm dev`
Navigate to `http://localhost:3000`. Verify:
- Two source cards appear (Kafka, OTLP)
- Clicking Kafka shows the existing topic count cards
- Clicking OTLP shows the three signal type cards
- Clicking a signal type opens the CreatePipelineModal
- After naming, the wizard loads with the OTLP journey

- [ ] **Step 5: Commit**

```bash
git add src/components/home/HomePageClient.tsx
git commit -m "feat: add source selection to home page (Kafka vs OTLP)"
```

---

## Task 8: Adapt shared steps for OTLP — Filter & Transformation

**Files:**
- Modify: `src/modules/filter/FilterConfigurator.tsx`
- Modify: `src/modules/transformation/TransformationConfigurator.tsx`

- [ ] **Step 1: Update FilterConfigurator to use source-aware schema fields**

In `src/modules/filter/FilterConfigurator.tsx`, add imports:

```typescript
import { isOtlpSource } from '@/src/config/source-types'
import { getSourceSchemaFields } from '@/src/utils/source-schema-fields'
```

Update the store destructuring (around line 37) to also read `coreStore` and `otlpStore`:

```typescript
const { coreStore, filterStore, topicsStore, otlpStore } = useStore()
```

Replace the `availableFields` useMemo block (lines 52-85) with:

```typescript
const availableFields = useMemo((): Array<{ name: string; type: string }> => {
  if (isOtlpSource(coreStore.sourceType)) {
    return otlpStore.schemaFields.map((f) => ({ name: f.name, type: f.type }))
  }

  // Existing Kafka logic unchanged
  if (eventSchema && eventSchema.length > 0) {
    return eventSchema
      .filter((f: any) => !f.isRemoved)
      .map((f: any) => ({
        name: f.name,
        type: f.userType || f.type || 'string',
      }))
  }

  if (selectedEvent?.event) {
    const fields: Array<{ name: string; type: string }> = []
    const extractFields = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fieldName = prefix ? `${prefix}.${key}` : key
        let fieldType = 'string'
        if (typeof value === 'number') {
          fieldType = Number.isInteger(value) ? 'int' : 'float64'
        } else if (typeof value === 'boolean') {
          fieldType = 'bool'
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extractFields(value, fieldName)
          continue
        }
        fields.push({ name: fieldName, type: fieldType })
      }
    }
    extractFields(selectedEvent.event)
    return fields
  }

  return []
}, [coreStore.sourceType, otlpStore.schemaFields, eventSchema, selectedEvent])
```

- [ ] **Step 2: Update TransformationConfigurator similarly**

In `src/modules/transformation/TransformationConfigurator.tsx`, add imports:

```typescript
import { isOtlpSource } from '@/src/config/source-types'
```

Update the store access (line 42):

```typescript
const { coreStore, transformationStore, topicsStore, otlpStore } = useStore()
```

The transformation configurator uses `useAvailableFields(schemaFields, effectiveEventData, ...)` hook. For OTLP, we need the hook to receive the OTLP fields. Update the call at line 67:

```typescript
const otlpFields = isOtlpSource(coreStore.sourceType) ? otlpStore.schemaFields : undefined
const availableFields = otlpFields
  ? otlpFields.map((f) => ({ name: f.name, type: f.type }))
  : useAvailableFields(schemaFields, effectiveEventData, transformationConfig.fields)
```

Note: This avoids conditional hook calls — `useAvailableFields` is still called unconditionally in the Kafka path. For OTLP, we short-circuit before the hook. If this causes a conditional hook issue, instead modify `useAvailableFields` to accept an override parameter:

Alternative approach — in `src/modules/transformation/hooks/useAvailableFields.ts`, add an `overrideFields` parameter:

```typescript
export function useAvailableFields(
  schemaFields: SchemaField[] | undefined,
  effectiveEventData: Record<string, unknown> | null,
  existingTransformFields: TransformField[] | undefined,
  overrideFields?: Array<{ name: string; type: string }>,
): Array<{ name: string; type: string }> {
  return useMemo(() => {
    if (overrideFields && overrideFields.length > 0) {
      return overrideFields
    }
    // ... existing logic unchanged ...
  }, [schemaFields, effectiveEventData, existingTransformFields, overrideFields])
}
```

Then in TransformationConfigurator:

```typescript
const otlpFields = isOtlpSource(coreStore.sourceType)
  ? otlpStore.schemaFields.map((f) => ({ name: f.name, type: f.type }))
  : undefined
const availableFields = useAvailableFields(schemaFields, effectiveEventData, transformationConfig.fields, otlpFields)
```

- [ ] **Step 3: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/modules/filter/FilterConfigurator.tsx src/modules/transformation/TransformationConfigurator.tsx src/modules/transformation/hooks/useAvailableFields.ts
git commit -m "feat: adapt filter and transformation steps for OTLP schema fields"
```

---

## Task 9: Adapt resources step — hide ingestor for OTLP

**Files:**
- Modify: `src/modules/resources/PipelineResourcesConfigurator.tsx`
- Modify: `src/modules/resources/PipelineResourcesFormRenderer.tsx`
- Modify: `src/modules/resources/PipelineResourcesFormManager.tsx`

- [ ] **Step 1: Add isOtlp flag to PipelineResourcesConfigurator**

In `src/modules/resources/PipelineResourcesConfigurator.tsx`, add import:

```typescript
import { isOtlpSource } from '@/src/config/source-types'
```

Add after the existing store destructuring (around line 40):

```typescript
const isOtlp = isOtlpSource(coreStore?.sourceType || 'kafka')
```

Update `pipelineShape` (line 59) to include `isOtlp`:

```typescript
const pipelineShape = { hasJoin, hasTransform, hasDedup, isOtlp }
```

- [ ] **Step 2: Update PipelineResourcesFormManager**

In `src/modules/resources/PipelineResourcesFormManager.tsx`, update the `pipelineShape` type (line 67):

```typescript
pipelineShape: { hasJoin: boolean; hasTransform: boolean; hasDedup: boolean; isOtlp: boolean }
```

- [ ] **Step 3: Update PipelineResourcesFormRenderer to hide ingestor**

In `src/modules/resources/PipelineResourcesFormRenderer.tsx`, update the props interface to include `isOtlp`:

```typescript
pipelineShape: {
  hasJoin: boolean
  hasTransform: boolean
  hasDedup: boolean
  isOtlp: boolean
}
```

Wrap the entire ingestor section (lines 109-151) in a conditional:

```typescript
{/* Ingestor — hidden for OTLP (shared receiver, not per-pipeline) */}
{!pipelineShape.isOtlp && (
  <>
    {pipelineShape.hasJoin ? (
      <>
        <ComponentSection title="Ingestor (Left)" prefix="ingestor.left" ... />
        <ComponentSection title="Ingestor (Right)" prefix="ingestor.right" ... />
      </>
    ) : (
      <ComponentSection title="Ingestor" prefix="ingestor.base" ... />
    )}
  </>
)}
```

- [ ] **Step 4: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/modules/resources/PipelineResourcesConfigurator.tsx src/modules/resources/PipelineResourcesFormRenderer.tsx src/modules/resources/PipelineResourcesFormManager.tsx
git commit -m "feat: hide ingestor resources for OTLP pipelines"
```

---

## Task 10: Adapt ClickHouse mapper — auto-suggest for OTLP

**Files:**
- Modify: `src/modules/clickhouse/ClickhouseMapper.tsx`
- Modify: `src/modules/clickhouse/hooks/useClickhouseMapperEventFields.ts`

- [ ] **Step 1: Make ClickhouseMapper OTLP-aware**

The ClickHouse mapper needs to provide source fields for OTLP. Currently it reads from `topicsStore`. For OTLP, we supply the predefined schema fields as the event field source.

In `src/modules/clickhouse/hooks/useClickhouseMapperEventFields.ts`, add imports:

```typescript
import { isOtlpSource } from '@/src/config/source-types'
```

In the hook, read OTLP store data:

```typescript
const { coreStore, otlpStore } = useStore()
const isOtlp = isOtlpSource(coreStore.sourceType)
```

In the single-topic auto-mapping logic, add an early return for OTLP that converts `otlpStore.schemaFields` to the event field format the mapper expects:

```typescript
if (isOtlp && otlpStore.schemaFields.length > 0) {
  // Convert OTLP predefined fields to event fields format
  const otlpEventFields = otlpStore.schemaFields.map((f) => ({
    name: f.name,
    type: f.type,
    value: f.type === 'string' ? '' : f.type === 'uint' || f.type === 'int' ? 0 : null,
  }))
  return otlpEventFields
}
```

The exact integration point depends on how `extractEventFields` works in the hook. The key idea: when `isOtlp`, bypass the topic/event extraction and use `otlpStore.schemaFields` directly.

- [ ] **Step 2: Verify auto-mapping works for OTLP**

Run: `pnpm dev`
Create an OTLP pipeline, reach the ClickHouse mapper step. Verify that:
- Source fields show the predefined OTLP fields
- Auto-mapping suggests field-to-column matches

- [ ] **Step 3: Commit**

```bash
git add src/modules/clickhouse/hooks/useClickhouseMapperEventFields.ts
git commit -m "feat: provide OTLP predefined fields to ClickHouse mapper"
```

---

## Task 11: Adapt review step and API submission for OTLP

**Files:**
- Modify: `src/modules/review/ReviewConfiguration.tsx`

- [ ] **Step 1: Update ReviewConfiguration to handle OTLP source**

In `src/modules/review/ReviewConfiguration.tsx`, add imports:

```typescript
import { isOtlpSource, getOtlpSignalLabel } from '@/src/config/source-types'
```

Update store access to include `otlpStore` and `coreStore`:

```typescript
const { coreStore, otlpStore, ... } = useStore()
const isOtlp = isOtlpSource(coreStore.sourceType)
```

The `generateApiConfig` call currently builds a Kafka-shaped payload. Add a conditional:

```typescript
const apiConfig = isOtlp
  ? generateOtlpApiConfig({
      pipelineId: coreStore.pipelineId,
      pipelineName: coreStore.pipelineName,
      otlpStore,
      clickhouseConnection,
      clickhouseDestination,
      filterStore,
      transformationStore,
      pipeline_resources: resourcesStore.pipeline_resources,
      version: coreStore.pipelineVersion,
    })
  : generateApiConfig({ /* existing Kafka params */ })
```

Add the `generateOtlpApiConfig` function (in the same file or as an export from `src/modules/clickhouse/utils.ts`):

```typescript
function generateOtlpApiConfig(params: {
  pipelineId: string
  pipelineName: string
  otlpStore: OtlpStore
  clickhouseConnection: any
  clickhouseDestination: any
  filterStore: any
  transformationStore: any
  pipeline_resources: any
  version: string | undefined
}): Partial<Pipeline> {
  const { pipelineId, pipelineName, otlpStore, clickhouseConnection, clickhouseDestination, filterStore, transformationStore, pipeline_resources, version } = params

  return {
    pipeline_id: pipelineId,
    name: pipelineName,
    version,
    source: {
      type: otlpStore.signalType || '',
      id: otlpStore.sourceId,
      deduplication: otlpStore.deduplication.enabled ? {
        enabled: true,
        id_field: otlpStore.deduplication.id_field,
        id_field_type: otlpStore.deduplication.id_field_type,
        time_window: otlpStore.deduplication.time_window,
      } : {
        enabled: false,
        id_field: '',
        id_field_type: '',
        time_window: '',
      },
    },
    join: { type: '', enabled: false, sources: [] },
    filter: filterStore?.filterConfig?.enabled ? {
      enabled: true,
      expression: filterStore.filterConfig.expression,
    } : undefined,
    stateless_transformation: transformationStore?.transformationConfig?.enabled ? {
      enabled: true,
      config: { transform: transformationStore.transformationConfig.fields },
    } : undefined,
    sink: {
      type: 'clickhouse',
      host: clickhouseConnection.host,
      httpPort: clickhouseConnection.httpPort,
      nativePort: clickhouseConnection.nativePort,
      database: clickhouseConnection.database,
      username: clickhouseConnection.username,
      password: clickhouseConnection.password,
      table: clickhouseDestination.tableName,
      secure: clickhouseConnection.secure,
      table_mapping: clickhouseDestination.mappedColumns || [],
      max_batch_size: clickhouseDestination.maxBatchSize || 1000,
      max_delay_time: clickhouseDestination.maxDelayTime || '5s',
      skip_certificate_verification: clickhouseConnection.skipCertificateVerification || false,
    },
    pipeline_resources: pipeline_resources ? {
      // No ingestor for OTLP
      transform: pipeline_resources.transform,
      sink: pipeline_resources.sink,
      nats: pipeline_resources.nats,
    } : undefined,
  }
}
```

Update the source rendering section to handle OTLP. In `renderTopics()` or the equivalent source section, add a conditional:

```typescript
{isOtlp ? (
  <div className="space-y-2">
    <p className="text-sm text-[var(--color-foreground-neutral)]">
      <strong>Source Type:</strong> OTLP {getOtlpSignalLabel(coreStore.sourceType)}
    </p>
    {otlpStore.deduplication.enabled && (
      <p className="text-sm text-[var(--color-foreground-neutral-faded)]">
        <strong>Deduplication:</strong> {otlpStore.deduplication.id_field} (window: {otlpStore.deduplication.time_window})
      </p>
    )}
  </div>
) : (
  /* existing Kafka topic rendering */
)}
```

- [ ] **Step 2: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/modules/review/ReviewConfiguration.tsx
git commit -m "feat: add OTLP source rendering and payload generation in review step"
```

---

## Task 12: Add OTLP hydration for edit/view mode

**Files:**
- Create: `src/store/hydration/otlp-source.ts`
- Modify: `src/store/core.ts`

- [ ] **Step 1: Create OTLP hydration function**

```typescript
// src/store/hydration/otlp-source.ts
import { useStore } from '@/src/store'
import { SourceType } from '@/src/config/source-types'
import { getOtlpFieldsForSignalType } from '@/src/modules/otlp/constants'
import type { PipelineConfigForHydration } from '@/src/types/pipeline'

export function hydrateOtlpSource(config: PipelineConfigForHydration) {
  const state = useStore.getState()
  const sourceType = config.source?.type

  if (!sourceType || !sourceType.startsWith('otlp.')) return

  // Set source type on core store
  state.coreStore.setSourceType(sourceType)
  state.coreStore.setTopicCount(1)

  // Set OTLP store
  state.otlpStore.setSignalType(sourceType as SourceType)
  state.otlpStore.setSourceId(config.source?.id || '')

  // Set deduplication if present
  const dedup = config.source?.deduplication
  if (dedup) {
    state.otlpStore.setDeduplication({
      enabled: dedup.enabled || false,
      id_field: dedup.id_field || '',
      id_field_type: dedup.id_field_type || 'string',
      time_window: dedup.time_window || '5m',
    })
  }

  // Mark as valid since we're loading existing config
  state.otlpStore.markAsValid()
}
```

- [ ] **Step 2: Wire hydration into core.ts**

In `src/store/core.ts`, add import:

```typescript
import { hydrateOtlpSource } from './hydration/otlp-source'
import { isOtlpSource } from '@/src/config/source-types'
```

In the `hydrateSection` method, add an `'otlp'` case:

```typescript
case 'otlp':
  hydrateOtlpSource(config)
  break
```

In the `'all'` case, add OTLP branching. Replace the sync section:

```typescript
case 'all':
  // Determine source type and hydrate accordingly
  if (config.source?.type && isOtlpSource(config.source.type)) {
    hydrateOtlpSource(config)
  } else {
    hydrateKafkaConnection(config)
    await hydrateKafkaTopics(config)
  }
  // Shared sections (source-agnostic)
  hydrateClickhouseConnection(config)
  hydrateJoinConfiguration(config)
  hydrateFilter(config)
  hydrateTransformation(config)
  await hydrateClickhouseDestination(config)
  await hydrateResources(config)
  break
```

- [ ] **Step 3: Verify the app compiles**

Run: `pnpm build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/store/hydration/otlp-source.ts src/store/core.ts
git commit -m "feat: add OTLP source hydration for edit/view mode"
```

---

## Task 13: End-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Build check**

Run: `pnpm build`
Expected: Clean build with no errors

- [ ] **Step 2: Manual E2E — OTLP pipeline creation**

Run: `pnpm dev`

Test flow:
1. Navigate to home page → verify Kafka/OTLP source cards appear
2. Select OTLP → verify Logs/Traces/Metrics cards appear
3. Select "Traces" → modal opens → enter name → enter wizard
4. Verify wizard shows: OTLP Source → (Filter if enabled) → (Transform if enabled) → ClickHouse Connection → Mapping → Resources → Review
5. On OTLP Source step: verify signal type pre-selected, schema preview shows 22 trace fields, dedup toggle works
6. Skip to ClickHouse connection → fill in → verify mapper shows OTLP fields
7. On Resources step → verify no ingestor section
8. On Review step → verify OTLP source info shown, JSON preview has `source.type: "otlp.traces"`

- [ ] **Step 3: Manual E2E — Kafka pipeline still works**

1. Go back to home → select Kafka → Single-Topic
2. Verify the entire Kafka flow is unchanged
3. Verify Kafka wizard steps are identical to before

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve issues found during E2E verification"
```
