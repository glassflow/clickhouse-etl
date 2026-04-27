# Adapter Layer

## Purpose

The adapter layer is the single authoritative boundary between how the app stores configuration in Zustand slices and what the backend wire format looks like.

Before this layer existed, source-type branching was scattered across the codebase — `isOtlpSource()` checks appeared in over 60 callsites covering wire-format building, schema derivation, hydration, and UI rendering. This meant that adding a new source type required hunting down and updating every one of those sites.

The adapter layer consolidates that branching into two focused contracts:

- **`SourceAdapter`** — encapsulates everything source-specific: how to serialize store state to the `source` block in `InternalPipelineConfig`, how to hydrate store slices from a wire config, and which wizard step keys apply.
- **`TransformPlugin`** — encapsulates a single transform stage: input/output schema contract, validation, and wire serialization in both directions.

Together they make the pipeline schema flow machine-readable: `domain.store.ts` can build and validate the full wire config without knowing anything about Kafka vs OTLP internals.

---

## Source Adapters

### Interface

```typescript
// src/types/adapters.ts

export interface SourceAdapter {
  readonly type: 'kafka' | 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'

  /** True when this source type supports the join section. */
  readonly supportsJoin: boolean

  /** True when filter and transformation sections are applicable for this source. */
  readonly supportsSingleTopicFeatures: boolean

  /**
   * Convert store state into the `source` section of InternalPipelineConfig.
   * Pure transformation — no side effects, no network calls.
   */
  toWireSource(storeState: SourceAdapterStoreState): SourceWireResult

  /**
   * Dispatch hydration from a wire config back to the store via callbacks.
   * No direct store writes — dispatches only to the callbacks in AdapterDispatch.
   */
  fromWireSource(wire: unknown, dispatch: AdapterDispatch): void | Promise<void>

  /**
   * Returns the StepKeys string IDs relevant for this source type.
   * Used to determine which steps are active in the wizard journey.
   */
  getTopicStepKeys(): string[]
}
```

**Field and method notes:**

- `type` — The discriminant string. Matches the values used in `SourceType` from `src/config/source-types.ts` and in `PipelineDomain.sources[n].type`.
- `supportsJoin` — Static flag. For `KafkaSourceAdapter` this is always `false` at the class level; the dynamic value (two topics → join enabled) is returned per-call in `SourceWireResult.supportsJoin`.
- `supportsSingleTopicFeatures` — Whether filter and stateless transformation steps apply. OTLP and single-topic Kafka: `true`. Multi-topic Kafka: `false`.
- `toWireSource(storeState)` — Receives a loosely-typed `SourceAdapterStoreState` snapshot (cast to a local shape internally). Must be pure — no side effects. Returns a `SourceWireResult` containing the serialized `source` block and the two feature flags.
- `fromWireSource(wire, dispatch)` — The inverse: given a raw backend config object, calls the appropriate callbacks on `dispatch` so the relevant store slices get hydrated. Never writes to the store directly.
- `getTopicStepKeys()` — Returns the step keys that should appear in the wizard journey for this source type. Used by `getWizardJourneyInstances` in `src/modules/create/utils.ts`.

### Supporting types

```typescript
export interface SourceWireResult {
  source: unknown                    // The serialized `source` field of InternalPipelineConfig
  supportsJoin: boolean              // Computed dynamically (e.g. two Kafka topics → true)
  supportsSingleTopicFeatures: boolean
}

export interface AdapterDispatch {
  hydrateKafkaConnection?: (wire: unknown) => void
  hydrateTopics?: (wire: unknown) => Promise<void>
  hydrateOtlp?: (wire: unknown) => void
}

export interface SourceAdapterStoreState {
  kafkaStore?: unknown
  topicsStore?: unknown
  deduplicationStore?: unknown
  otlpStore?: unknown
  coreStore?: unknown
  pipelineName?: string
}
```

### Existing implementations

| Class | File | Type string |
|---|---|---|
| `KafkaSourceAdapter` | `src/adapters/source/kafka/adapter.ts` | `'kafka'` |
| `OtlpSourceAdapter` | `src/adapters/source/otlp/adapter.ts` | `'otlp.logs'` / `'otlp.traces'` / `'otlp.metrics'` |

`OtlpSourceAdapter` accepts the signal type as a constructor argument; one instance per signal type is pre-constructed in the factory.

### Factory

`src/adapters/source/index.ts` is the single authoritative branch point — everything else calls `getSourceAdapter()`:

```typescript
export function getSourceAdapter(sourceType: string | undefined | null): SourceAdapter
```

Falls back to the Kafka adapter for unknown or missing types. `isOtlpSource()` is called only inside this factory; nowhere else.

---

## Adding a new source type

1. **Create the adapter file** at `src/adapters/source/<name>/adapter.ts`. Implement the `SourceAdapter` interface. Define local shapes for the store fields your adapter reads — mirror only what you need, do not import the full slice type.

2. **Implement the interface.** Key constraints:
   - `toWireSource` must be pure (no side effects, no `useStore` calls).
   - `fromWireSource` must only call callbacks on `dispatch`, never write to a store slice directly.
   - `getTopicStepKeys` returns the `StepKeys` values that should appear in the wizard when this source is active.

3. **Add the type discriminant** to the union in `src/types/adapters.ts`:
   ```typescript
   readonly type: 'kafka' | 'otlp.logs' | 'otlp.traces' | 'otlp.metrics' | 'your-new-type'
   ```

4. **Register in the factory** (`src/adapters/source/index.ts`). Add a branch in `getSourceAdapter` for the new type string:
   ```typescript
   if (sourceType === 'your-new-type') return yourNewAdapter
   ```

5. **Add the step keys** for your source to `src/config/constants.ts` (`StepKeys` enum) and register their step descriptors in `src/config/step-registry.ts`.

6. **Extend `AdapterDispatch`** if your source needs new hydration callbacks. Add the callback signature to the `AdapterDispatch` interface and implement it in `usePipelineHydration.ts`.

---

## Transform Plugins

### Interface

```typescript
// src/adapters/transform/registry.ts

export type TransformType = 'deduplication' | 'join' | 'filter' | 'stateless'

export interface TransformPlugin<TConfig = unknown> {
  readonly type: TransformType
  readonly enabled: boolean
  getInputSchema(upstream: SchemaField[]): SchemaField[]
  getOutputSchema(input: SchemaField[], config: TConfig): SchemaField[]
  validate(config: TConfig): { valid: boolean; errors: string[] }
  toWireFormat(config: TConfig): WireTransformConfig
  fromWireFormat(wire: WireTransformConfig): TConfig
}
```

**Field and method notes:**

- `type` — Discriminant matching `TransformType`. Used as the Map key in the registry.
- `enabled` — A getter that reads live store state to decide whether this transform is currently active. Used by schema derivation to skip disabled transforms.
- `getInputSchema(upstream)` — Given the schema produced by the stage above, return the schema this transform sees as its input. Most transforms pass through unchanged; a join or transformation may alter it.
- `getOutputSchema(input, config)` — Given the input schema and the current config, return the output schema this transform produces. Deduplication and filter return `input` unchanged (they only remove rows). The stateless transform adds, renames, or removes fields. This is the contract that makes schema flow machine-readable end-to-end.
- `validate(config)` — Returns `{ valid, errors }`. Called before wire serialization and during the review step.
- `toWireFormat(config)` — Serialize the typed config to the `WireTransformConfig` shape the backend expects. The `type` field in the result must match the plugin's own `type`.
- `fromWireFormat(wire)` — Deserialize a `WireTransformConfig` back to the typed config. Called during pipeline hydration.

### `getInputSchema` / `getOutputSchema` contract

Schema flows through the active transform chain in registration order. Each plugin receives the previous plugin's output as its `upstream` / `input`. The chain is evaluated lazily in `domain.store.ts#getSchema` via `getEffectiveSchemaFromPlugins` in `src/utils/schema-service.ts`.

Plugins that do not change the field set (deduplication, filter, join) return `input` unchanged from both methods. Only `stateless` (field-level transformations) alters the schema shape.

---

## Plugin registry

`src/adapters/transform/registry.ts` holds the Map and three public functions:

```typescript
export function registerTransformPlugin(plugin: TransformPlugin): void
export function getTransformPlugin(type: TransformType): TransformPlugin   // throws if not found
export function getAllTransformPlugins(): TransformPlugin[]
```

Plugins self-register via a side-effect call at the bottom of their file:

```typescript
// src/adapters/transform/deduplication/plugin.ts (example)
registerTransformPlugin(deduplicationPlugin)
```

These side effects are triggered by importing the plugin modules. `src/adapters/transform/index.ts` is the barrel that triggers all registrations:

```typescript
// Re-export registry API
export type { TransformType, WireTransformConfig, TransformPlugin } from './registry'
export { registerTransformPlugin, getTransformPlugin, getAllTransformPlugins } from './registry'

// Side-effect imports — order matters: registry exports must come first
import './deduplication/plugin'
import './join/plugin'
import './filter/plugin'
import './stateless/plugin'
```

Any module that calls `getTransformPlugin` or `getAllTransformPlugins` should import from `src/adapters/transform` (the barrel), not directly from `registry.ts`, so that registrations have already run.

---

## Adding a new transform

1. **Create the plugin file** at `src/adapters/transform/<name>/plugin.ts`. Define a local `WireXxxConfig` interface extending `WireTransformConfig` and implement `TransformPlugin<YourConfig>`.

2. **Define schema behavior.** If the transform does not alter field shape, return `input` from both `getInputSchema` and `getOutputSchema`. If it does (e.g. adds or removes fields), compute the correct output schema from `config`.

3. **Add the discriminant** to `TransformType` in `src/adapters/transform/registry.ts`:
   ```typescript
   export type TransformType = 'deduplication' | 'join' | 'filter' | 'stateless' | 'your-new-type'
   ```

4. **Self-register** at the bottom of your plugin file:
   ```typescript
   registerTransformPlugin(yourPlugin)
   export { yourPlugin }
   ```

5. **Add the side-effect import** to `src/adapters/transform/index.ts`:
   ```typescript
   import './your-new-type/plugin'
   ```

6. **Wire up store integration** if the plugin reads live Zustand state in its `enabled` getter (follow the pattern in `deduplication/plugin.ts` using `useStore.getState()`).

7. **Add wizard step** if the transform needs a configuration UI: register a `StepDescriptor` in `src/config/step-registry.ts` with `sectionKey: 'processing'` and add the step key to the appropriate journey in `src/modules/create/utils.ts`.

---

## Relationship to `PipelineDomain` and `domain.store.ts`

`PipelineDomain` (`src/types/pipeline-domain.ts`) is the canonical in-memory model of a pipeline:

```typescript
export interface PipelineDomain {
  id?: string
  name: string
  sources: SourceConfig[]      // one entry per topic / OTLP signal
  transforms: TransformConfig[] // ordered transform chain
  sink: SinkConfig
  resources: ResourceConfig
}
```

`domain.store.ts` provides two bridge methods:

**`syncFromSlices()`** reads all existing wizard slices (kafkaStore, topicsStore, deduplicationStore, etc.) and assembles a `PipelineDomain`. This is the bridge that keeps the wizard working without rewriting it. Call this after any `hydrateSection()` completes.

**`toWireFormat()`** derives `InternalPipelineConfig` from the domain model. It calls `getSourceAdapter(sourceType).toWireSource(snapshot)` to build the `source` block — passing a minimal store snapshot constructed from domain fields. Transform plugins are not called directly in `toWireFormat`; instead the active transforms' serialized `config` objects are placed into the appropriate wire fields (`filter`, `transformation`, `join`).

**`getSchema()`** evaluates the active transform chain by calling `getEffectiveSchemaFromPlugins` from `schema-service.ts`, which calls each plugin's `getInputSchema` / `getOutputSchema` in order. Only `filter` and `stateless` plugins are included in this chain because they are the only two that affect field shape.

The flow from wizard interaction to wire format is therefore:

```
User fills wizard steps
        ↓
Wizard slices update (kafkaStore, topicsStore, …)
        ↓
hydrateSection() / step submit calls domainStore.syncFromSlices()
        ↓
domain.store.ts#syncFromSlices() populates PipelineDomain
        ↓
domainStore.toWireFormat() → getSourceAdapter().toWireSource() → InternalPipelineConfig
```

When the canvas or AI lane writes directly to `domainStore.setDomain()`, the wizard slices are bypassed — `toWireFormat` still works because it operates on `PipelineDomain`, not on the wizard slices directly.
