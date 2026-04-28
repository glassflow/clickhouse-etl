# Pipeline Configuration UI — Architecture Analysis 2026

> **Purpose:** A critical analysis of the current frontend architecture, identifying coupling problems and domain model gaps, with a concrete refactoring direction that can support multiple UX surfaces (wizard, composer, AI-chat) without a rewrite.

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Store / State Management Analysis](#2-store--state-management-analysis)
3. [Wizard Flow Analysis](#3-wizard-flow-analysis)
4. [Current Coupling Problems](#4-current-coupling-problems)
5. [Domain Model Gaps](#5-domain-model-gaps)
6. [Proposed Abstractions](#6-proposed-abstractions)
7. [Target Architecture](#7-target-architecture)
8. [Migration Strategy](#8-migration-strategy)
9. [Risks and Tradeoffs](#9-risks-and-tradeoffs)
10. [Concrete Refactoring Recommendations](#10-concrete-refactoring-recommendations)
11. [Folder / Module Structure](#11-folder--module-structure)
12. [Testing Strategy](#12-testing-strategy)
13. [Open Questions](#13-open-questions)

---

## 1. Current Architecture Summary

### What the app does

A Next.js 16 (App Router) frontend for constructing and deploying ETL pipelines. A pipeline ingests data from a **Source** (Kafka or OTLP), applies **Transforms** (deduplication, join, filter, stateless transformations), and writes to a **Sink** (ClickHouse).

The primary surface is a multi-step wizard at `/pipelines/create`. It collects configuration interactively, assembles an internal config, and POSTs to the backend. Pipelines can then be viewed and individually edited at `/pipelines/[id]`.

### Key data flows

**Create flow:**
```
HomePageClient
  → enterCreateMode() / resetForNewPipeline()
  → /pipelines/create
  → PipelineWizard (reads journey from store)
  → each step component writes into its own slice
  → ReviewConfiguration
      → generateApiConfig() → buildInternalPipelineConfig() → adapter.generate()
  → POST /ui-api/pipeline
  → axios proxy to Go backend
```

**View / Edit flow:**
```
/pipelines/[id] (SSR)
  → getPipeline(id)
  → usePipelineHydration()
      → adapter.hydrate(apiResponse)
      → enterViewMode(internalConfig)
      → hydrateSection('all', config)  // dispatches to 10 per-section hydrators
  → PipelineDetailsModule (section panels)
  → StandaloneStepRenderer (per-section editing, shares step components with wizard)
```

### State shape

Thirteen Zustand slices composed into one root store via `useStore()`:

| Slice | Responsibility |
|---|---|
| `coreStore` | Pipeline metadata, mode, dirty flag, hydration orchestration, save history |
| `stepsStore` | Wizard step progression (active, completed, resume) |
| `kafkaStore` | Kafka connection form state (all auth mechanisms) |
| `topicsStore` | Selected topics, event cache, verified schema per topic |
| `otlpStore` | OTLP signal type, source id, schema fields |
| `deduplicationStore` | Per-topic dedup configs (indexed by topic index) |
| `joinStore` | Join stream config, type, enabled flag |
| `filterStore` | Filter tree and expression string |
| `transformationStore` | Transformation fields and expression string |
| `clickhouseConnectionStore` | CH connection + cached databases/tables/schemas |
| `clickhouseDestinationStore` | Target DB/table/mapping/batching |
| `resourcesStore` | CPU/mem/replicas, `fields_policy` |
| `notificationsStore` | User-facing toast notifications |

---

## 2. Store / State Management Analysis

### What works well

- The namespaced slice pattern (`{ xxxStore: { ...props, ...methods } }`) is clean and discoverable; consuming components can destructure exactly what they need.
- Consistent `ValidationMethods` interface (`markAsValid`, `markAsInvalidated`, `markAsNotConfigured`) and `reset<Store>Store()` per slice make reset and validation uniform.
- `src/store/hydration/*.ts` files separate backend wire-format mapping from slice logic — a sound instinct.
- Devtools integration with trace mode is present.

### Structural weaknesses

**1. Every setter replays a full slice object.**
Every `set((s) => ({ kafkaStore: { ...s.kafkaStore, field } }))` call forces Zustand to re-compare the whole slice. No `subscribeWithSelector`, `useShallow`, or per-field selectors are used. Any field change in `kafkaStore` re-renders every component subscribed to `kafkaStore`.

**2. Cross-slice writes via `get() as any`.**
Slices reach across into other slices by casting `get()` to `any`. Examples:
- `coreStore.getComputedOperation()` reads `deduplicationStore` + `joinStore` via cast (`core.ts:222`)
- `topicsStore.invalidateTopicDependentState()` calls `joinStore.setStreams([])` and `deduplicationStore.invalidateDeduplication()` via cast (`topics.store.ts:83–98`)

This defeats TypeScript, creates hidden bidirectional coupling, and makes refactoring risky.

**3. Three overlapping global reset functions.**
`resetAllPipelineState`, `resetForNewPipeline`, and `clearAllUserData` each enumerate all thirteen slice reset methods with ~85% overlap. Any new slice must be registered in all three.

**4. Two "operation type" representations.**
`coreStore.topicCount` is the source of truth, but `coreStore.operationsSelected.operation` is a derived string that must be recomputed every time `setTopicCount` is called (`core.ts:184–200`). The compute function is commented "backward compatibility" — but it's still read by the wizard journey builder.

**5. Hydration mixes pure mapping with live network calls.**
`hydrateKafkaTopics` (`src/store/hydration/topics.ts`) is 400+ lines and does: format normalization, auth-mechanism detection, three API calls to the broker, per-topic partition enrichment, and event sample fetching — all in one function. A pure mapping function and a side-effectful enrichment step are entangled.

**6. Import cycle via hydrators.**
`core.ts` → `hydration/kafka-connection.ts` → `store/index.ts` → `core.ts`. This is only workable because Zustand stores are lazily read. The `core.ts:587` dynamic `await import('./index')` workaround is evidence the coupling is already painful.

**7. Duplicated Go-duration parsing.**
`hydrateGoToDuration` / `durationToMs` / `parseDurationToMs` appear in three hydrator files with subtly different rounding rules. Each consumer inlines its own version.

**8. Stale `apiConfig` mirror.**
`coreStore.apiConfig` is typed as `Partial<Pipeline>` but the canonical truth is derived from live slices via `generateApiConfig()` at submit time. `apiConfig` is set only on load and becomes stale as the user edits. `ReviewConfiguration` falls back to it on error — a fragile escape hatch.

---

## 3. Wizard Flow Analysis

### Step definitions and journey computation

`StepKeys` (`src/config/constants.ts`) is a flat enum of 17 step IDs. Journeys are **arrays of `StepKeys`** assembled at runtime in `src/modules/create/utils.ts`:

- `getSingleTopicJourney()` — 1 Kafka topic
- `getTwoTopicJourney()` — 2 Kafka topics (contains `DEDUPLICATION_CONFIGURATOR` **twice** — positional inference, not explicit)
- `getOtlpJourney()` — OTLP sources
- Four legacy journey functions kept for `getWizardJourneyStepsFromOperation()` compatibility

Feature flag checks (`isFiltersEnabled`, `isTransformationsEnabled`) run inside journey builders, so toggling a flag mid-session without a reload produces inconsistent step lists.

**`StepInstance`** is a derived concept (`utils.ts:282`) that assigns `topicIndex: 0|1` by counting whether a `TOPIC_SELECTION_2` key has been crossed in the array. Adding a third topic count would require rewriting this positional inference.

### How guards work (three inconsistent mechanisms)

1. **Path-level redirect** — `PipelineWizard` `useEffect` pushes to `/` if `topicCount` is missing for Kafka. OTLP skips this check entirely.
2. **Feature flag step omission** — journey functions simply don't include filtered steps. The step "doesn't exist" rather than being explicitly disabled.
3. **Validation status scan** — `useWizardSmartNavigation.findBlockingStep` walks completed step IDs looking for `INVALIDATED` states.

A fourth partial mechanism — `guard` fields in `STEP_RENDERER_CONFIG` — exists for the edit-mode standalone renderer but has no equivalent in the wizard.

The `DEPENDENCY_GRAPH` in `src/store/state-machine/dependency-graph.ts` was clearly designed to become the formal guard system, but it covers only Kafka source steps and is missing OTLP, filter, transformation, and resources nodes.

### Navigation fragility points

- `enterCreateMode()` resets `sourceType` to `'kafka'` (by spreading `initialCoreStore`). `ReviewConfiguration` has an explicit comment about this: *"coreStore.sourceType can be unreliable because enterCreateMode() resets it to 'kafka'"* — it cross-references `otlpStore.signalType` as a fallback.
- `completedStepIds` is stored as a flat string array. `removeCompletedStepsAfterId` uses `journeyInstanceIds.indexOf(id)` to prune — if the journey array was regenerated between renders, the lookup misses and the prune silently no-ops.
- `StepInstance` identity (`${key}-${topicIndex}` or `${key}-${journeyIndex}`) is reused as a completed-steps key, a navigation target, and a sidebar row ID simultaneously. The same string can mean "journey index 0" or "topic index 0" depending on context.

### Create vs. Edit differences

| | Create | Edit / View |
|---|---|---|
| **Entry** | `enterCreateMode()` — full reset | `usePipelineHydration()` → `enterViewMode()` |
| **Shell** | `PipelineWizard` (linear, step-by-step) | `PipelineDetailsModule` + `StandaloneStepRenderer` (section panels) |
| **Mode** | `'create'` | `'view'` → `'edit'` on user action |
| **Step registry** | `componentsMap` in `create/utils.ts` | `STEP_RENDERER_CONFIG` in `step-renderer/stepRendererConfig.ts` |
| **Prop shaping** | `renderStepComponent()` in `create/utils.ts` | `getStepProps()` in `step-renderer/stepProps.ts` |
| **Navigation** | Linear journey progression | Each section opens as independent modal/panel |
| **Dirty detection** | `markAsDirty()` | `isDirtyComparedToBase()` — compares only `pipeline_id` and `name` (shallow) |

**The same step components are used in both shells, but each shell hand-crafts its own prop signature.** New steps must be registered in both `componentsMap` and `STEP_RENDERER_CONFIG`, and prop shaping must be duplicated in both `renderStepComponent` and `getStepProps`.

---

## 4. Current Coupling Problems

### Kafka is embedded in generic infrastructure

- The `DEPENDENCY_GRAPH` in `src/store/state-machine/dependency-graph.ts` treats `kafka-connection` as the sole root source node. OTLP has no node. Any validation dependency that touches OTLP cannot participate.
- `buildInternalPipelineConfig` (`src/modules/clickhouse/utils.ts:91–529`) is fundamentally Kafka-shaped: iterates `selectedTopics`, maps deduplication per-topic, builds `connectionParams` by switching on seven auth mechanisms (lines 277–370), then diverges to a separate OTLP branch (lines 375–395). Adding a third source type means a third `if` branch.
- `topicsStore.invalidateTopicDependentState()` writes directly into `joinStore` and `deduplicationStore` — so the Kafka-specific "topic changed" event causes cross-domain side effects inside the source-type store.
- `PipelineWizard.getStepTitle()` hard-codes `"Left Topic"` / `"Right Topic"` with direct `topicsStore.topics[0/1]` lookups.
- Docker broker host normalization (`normalizeBroker`) appears in both `src/modules/clickhouse/utils.ts:266–274` and `src/app/ui-api/pipeline/route.ts:152–159` — Kafka-specific logic in two places.

### ClickHouse is embedded in generic infrastructure

- `clickhouseConnectionStore` embeds ClickHouse-specific schema caching (`databases`, `tables: Record<string,string[]>`, `tableSchemas`) inside what should be a generic connection concept.
- `buildInternalPipelineConfig.sink` always emits `type: 'clickhouse'` with CH-specific fields. There is no `Sink` abstraction.
- The pipeline proxy route (`src/app/ui-api/pipeline/route.ts`) embeds ClickHouse table creation logic: if `isCreateNewTableFlow`, it creates the table first and rolls back on pipeline creation failure. This CH-specific orchestration lives in a generic API route.
- The `isCreateNewTableFlow` concept (`destinationPath === 'create'`) is ClickHouse-specific but drives branches throughout the mapper UI and the API route.

### Wizard UI and business logic are entangled

- Journeys are arrays of `StepKeys` (a UI concept), but they carry semantic meaning: the position of `TOPIC_SELECTION_2` in the array determines the topic index for every subsequent step instance. There is no domain concept of "source with index" — only wizard position.
- `buildInternalPipelineConfig` accepts all stores as parameters and re-extracts fields itself, bypassing what the slices already know about themselves.
- `ReviewConfiguration` computes the final config on render via `useMemo`, then `handleContinueToPipelines` sends it — the "current config" responsibility exists twice.
- Two shells (`PipelineWizard`, `StandaloneStepRenderer`) each construct their own component registries. New steps require registration in six places: `StepKeys` enum, `stepsMetadata`, `componentsMap`, `STEP_RENDERER_CONFIG`, `sidebarStepConfig`, and the dependency graph.

---

## 5. Domain Model Gaps

### No generic `Source` / `Sink` / `Transform` interfaces

The codebase checks `isOtlpSource(sourceType)` in approximately 60 locations. There is no polymorphic `Source` object with methods like `getConnectionParams()`, `getTopics()`, `getSchema()`. Instead, `{type, connection_params, topics}` (Kafka) and `{type, id, deduplication}` (OTLP) are duck-typed at every usage site.

Similarly, there is no `Sink` interface. Two ClickHouse-specific stores serve the role.

For transforms, four separate stores hold what the backend already treats as one concept — the v3 API wire format uses `transforms: [{type: 'dedup'|'filter'|'stateless', source_id, config}]`. The adapter splits them into UI stores on hydrate and recombines them on generate. The UI mirrors the backend's data without mirroring the backend's model.

### No unified schema pipeline

Schema exists in at least four incompatible representations:

1. **Topic schema**: `topicsStore.topics[i].schema.fields: [{name, type, userType?, inferredType?, isRemoved?, isManuallyAdded?}]`
2. **CH destination columns**: `clickhouseDestinationStore.destinationColumns: [{name, type, isNullable, default_type, ...}]`
3. **Mapper rows**: `clickhouseDestinationStore.mapping: [{name, type, eventField, sourceTopic, jsonType, isNullable}]`
4. **OTLP fields**: `otlpStore.schemaFields: OtlpSchemaField[]` (predefined constants, not user-verified)

Plus two wire format variants (V1 `table_mapping`, V2 `schema.fields`) that the hydrators must reconcile.

The desired schema flow — *source schema → transformation input → transformation output → sink mapping* — is not modeled as a pipeline. It is ad-hoc lookups: `useClickhouseMapperEventFields` checks `transformationStore.enabled` and calls `getIntermediarySchema()` (609 lines of imperative reconciliation). The intermediary schema is not a first-class object; it is computed on every render.

Type conversion appears three times with different edge cases:
- `getDefaultClickHouseType(jsonType)` in `utils.ts:912–928`
- `mapClickHouseTypeToJsonType` in `hydration/clickhouse-destination.ts:109–127`
- `inferJsonType` in `utils.ts:618–645`

### `topicCount` vs. multi-source abstraction

`topicCount` is a `number` everywhere. There is no `sources: Source[]` collection. Enabling a third topic, or a mixed Kafka+OTLP pipeline, or an arbitrary number of topics, would cascade through journey functions, dependency graphs, wizard instance calculations, and `StepKeys` literals (`TOPIC_SELECTION_1`, `TOPIC_SELECTION_2`).

### Step descriptor is split across six declarations

Each step requires registration in:
1. `StepKeys` enum (`src/config/constants.ts`)
2. `stepsMetadata` record (`src/config/constants.ts`)
3. `componentsMap` in `src/modules/create/utils.ts` (wizard shell)
4. `STEP_RENDERER_CONFIG` in `src/modules/pipelines/[id]/step-renderer/stepRendererConfig.ts` (edit shell)
5. `sidebarStepConfig` in `src/modules/create/utils.ts`
6. `DEPENDENCY_GRAPH` in `src/store/state-machine/dependency-graph.ts`

---

## 6. Proposed Abstractions

The central observation: **the pipeline domain model does not exist as a first-class concept**. The wizard is simultaneously the UI flow controller and the implicit domain model. Separating them is the core of the refactor.

### 6.1 `Source` adapter interface

```ts
interface SourceAdapter<TConfig, TConnectionParams> {
  readonly type: SourceType;
  validateConnection(params: TConnectionParams): Promise<ConnectionResult>;
  getTopics?(params: TConnectionParams): Promise<Topic[]>;
  getSchema(topicId: string, params: TConnectionParams): Promise<SchemaField[];
  toWireFormat(config: TConfig): WireSourceConfig;
  fromWireFormat(wire: WireSourceConfig): TConfig;
}
```

Implementations: `KafkaSourceAdapter`, `OtlpSourceAdapter`. The stores (`kafkaStore`, `topicsStore`, `otlpStore`) become the adapter's internal state, not the primary interface.

### 6.2 `Sink` adapter interface

```ts
interface SinkAdapter<TConfig, TConnectionParams> {
  readonly type: SinkType;
  validateConnection(params: TConnectionParams): Promise<ConnectionResult>;
  getSchema(params: TConnectionParams): Promise<SchemaField[]>;
  toWireFormat(config: TConfig): WireSinkConfig;
  fromWireFormat(wire: WireSinkConfig): TConfig;
}
```

Implementation: `ClickHouseSinkAdapter`.

### 6.3 `Transform` registry

The four transform stores (`deduplicationStore`, `joinStore`, `filterStore`, `transformationStore`) should become registered implementations of a common `Transform` concept:

```ts
interface TransformPlugin {
  readonly type: TransformType; // 'dedup' | 'join' | 'filter' | 'stateless'
  getInputSchema(upstreamSchema: SchemaField[]): SchemaField[];
  getOutputSchema(inputSchema: SchemaField[], config: unknown): SchemaField[];
  validate(config: unknown): ValidationResult;
  toWireFormat(config: unknown): WireTransform;
  fromWireFormat(wire: WireTransform): unknown;
}
```

This makes the schema flow explicit: each transform declares what schema it consumes and what schema it produces.

### 6.4 Canonical `SchemaField` type

A single internal schema type used everywhere, with provenance tracking:

```ts
interface SchemaField {
  name: string;
  type: InternalFieldType; // normalized, not source-specific
  nullable: boolean;
  source?: 'topic' | 'transform' | 'inferred' | 'user';
  originalType?: string; // the raw type before normalization
}
```

Type conversion happens once at the source adapter boundary; all downstream code works with `SchemaField`.

### 6.5 `PipelineDomain` — the shared domain model

A domain object that can be populated by wizard, AI chat, or file import and rendered by any shell:

```ts
interface PipelineDomain {
  id?: string;
  name: string;
  sources: SourceConfig[];         // indexed collection, not topicCount
  transforms: TransformConfig[];   // ordered pipeline, not four separate stores
  sink: SinkConfig;
  resources: ResourceConfig;
  // derived
  getSchema(): SchemaField[];      // final output schema for sink mapping
  validate(): ValidationReport;
}
```

### 6.6 `StepDescriptor` — single registration point

```ts
interface StepDescriptor {
  key: StepKey;
  title: string | ((context: PipelineDomain) => string);
  component: React.ComponentType<StepProps>;
  guard?: (domain: PipelineDomain) => boolean;
  dependsOn?: StepKey[];         // replaces dependency-graph hard-coding
  sectionKey: SectionKey;        // maps to a domain section for dirty tracking
  // edit-mode
  canEditInPlace?: boolean;
  editTitle?: string;
}
```

One object per step, consumed by both wizard and standalone renderer.

---

## 7. Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Shell Layer                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  PipelineWizard│  │Composer View │  │   AI Chat View      │   │
│  │  (linear)   │  │(non-linear)  │  │  (guided by AI)     │   │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         └────────────────┴──────────────────────┘               │
│                          │ consumes                             │
├──────────────────────────▼──────────────────────────────────────┤
│               PipelineDomain (Zustand core store)               │
│  sources: SourceConfig[]   transforms: TransformConfig[]        │
│  sink: SinkConfig          resources: ResourceConfig            │
│  getSchema()   validate()  dirty tracking  save history         │
├─────────────────────────────────────────────────────────────────┤
│                       Adapter Layer                             │
│  SourceAdapter  │  SinkAdapter  │  TransformPlugin[]            │
│  KafkaAdapter   │  ClickHouse   │  DeduplicationPlugin          │
│  OtlpAdapter    │  Adapter      │  JoinPlugin                   │
│  (future)       │  (future)     │  FilterPlugin                 │
│                 │               │  StatelessPlugin              │
├─────────────────────────────────────────────────────────────────┤
│                     Schema Pipeline                             │
│  SourceSchema → [Transform₁ → Transform₂ → ...] → SinkSchema   │
├─────────────────────────────────────────────────────────────────┤
│             Wire Format (v3 API) ↔ Internal Domain              │
│              PipelineAdapter.hydrate() / generate()             │
└─────────────────────────────────────────────────────────────────┘
```

### Design-time vs. runtime state separation

**Design-time state** (what the UI manages):
- `PipelineDomain` — the configuration being built or edited
- Section validation status
- Dirty tracking per section

**Deployment state** (what comes from the backend on pipeline load):
- `pipeline_status: 'running' | 'stopped' | 'error'`
- `pipeline_id`, `created_at`, `updated_at`
- `version`, `config_hash`

**Runtime/observability state** (future):
- Message throughput, lag, error rate
- DLQ contents
- Health events

These three concerns should be in separate slices with separate hydration paths. Currently, `coreStore` conflates design-time config with deployment status.

### The three UX surfaces sharing one domain model

| Surface | Input mechanism | Produces |
|---|---|---|
| Wizard | Linear step completion | `PipelineDomain` via step components |
| Composer | Independent section editing | `PipelineDomain` via section components |
| AI Chat | LLM intent → `materializeIntentToStore()` | `PipelineDomain` via intent bridge |

All three call `PipelineDomain.validate()` for the same output and `PipelineAdapter.generate()` for the same wire format. Only the input mechanism differs.

---

## 8. Migration Strategy

This should be an incremental migration, not a rewrite. The following phases can be executed on the current `main` branch without breaking existing functionality.

### Phase 1: Consolidate step registration (2–3 days)

Create a `src/config/step-registry.ts` that is the single source of truth for all step metadata. Refactor `componentsMap`, `STEP_RENDERER_CONFIG`, and `sidebarStepConfig` to consume this registry. Both shells read from the same registry.

**Benefit:** New steps require one registration. Immediate reduction in duplication.

### Phase 2: Introduce canonical `SchemaField` (3–5 days)

Create `src/types/schema.ts` with `SchemaField`, `SchemaFieldSource`, and a `SchemaRegistry` class that owns conversion functions (JSON → CH type, CH → JSON type). Remove duplicated type conversion functions from `utils.ts`, `hydration/clickhouse-destination.ts`, and `hydration/topics.ts`.

Introduce `SchemaService.getEffectiveSchema(domain): SchemaField[]` as the single function that computes the schema visible to the sink mapper, replacing the logic in `useClickhouseMapperEventFields`.

**Benefit:** Single type conversion path, traceable schema provenance, simplified mapper hook.

### Phase 3: Extract `SourceAdapter` interface (1 week)

Create `src/adapters/source/` with `SourceAdapter` interface and `KafkaSourceAdapter` + `OtlpSourceAdapter` implementations. Move the `isOtlpSource()` branches in `buildInternalPipelineConfig`, `dependency-graph.ts`, and `hydrateSection('all')` into the adapter dispatch.

**Benefit:** Eliminates ~60 `isOtlpSource` call sites. Adding a new source type requires one new adapter, not branching everywhere.

### Phase 4: Unify transform stores (1 week)

Create `src/adapters/transform/` with `TransformPlugin` interface. Wire the four existing transform stores as plugin implementations. The `DEPENDENCY_GRAPH` and validation engine can drive their cross-dependencies through the plugin interface instead of direct cross-slice writes.

**Benefit:** `buildInternalPipelineConfig` no longer needs to know about dedup/join/filter independently. Schema pipeline becomes explicit.

### Phase 5: `PipelineDomain` core model (2 weeks)

Introduce `PipelineDomain` as a structured object in `coreStore` or a new `domainStore`. Migrate `hydrateSection` to populate `PipelineDomain` instead of individual slices. The individual slices become local UI state for their respective step components, not the system of record.

**Benefit:** AI flow, composer flow, and wizard flow all read/write the same object. Clean design-time / runtime separation.

### Phase 6: Separate design-time and runtime stores (3–5 days)

Split `coreStore` into:
- `pipelineConfigStore` — design-time `PipelineDomain`
- `pipelineDeploymentStore` — `status`, `id`, `version`, `created_at`
- `pipelineRuntimeStore` — observability data (initially empty, populated later)

**Benefit:** Makes the future observability/status UI trivially addable without touching configuration logic.

---

## 9. Risks and Tradeoffs

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Adapter abstraction over-engineering | Medium | Start with `SourceAdapter` only; do not prematurely abstract `SinkAdapter` until a second sink type is planned |
| Migration phase bleed-over | High | Each phase must ship to `main` independently. Phase boundaries should be clean compile boundaries, not just conceptual ones |
| Schema normalization regressions | High | Create a `SchemaField` conversion test suite before removing old type conversion functions |
| Step registry consolidation breaking edit-mode | Medium | Run both the wizard and the pipeline details page through manual QA after Phase 1 |
| `hydrateSection('all')` becoming a god function | Already true | Phase 3 breaks it into adapter-dispatched calls; accept the complexity until Phase 5 |
| AI intent materialization coupling | Low | `materializeIntentToStore()` already uses `hydrateSection()` — it benefits from Phase 5 automatically |

### Where abstraction would be premature

- **`SinkAdapter`** — ClickHouse is the only sink. Don't abstract until a second sink is scoped.
- **Saved/reusable connections UI** — valuable feature, but adding a persistence layer before the domain model is stable will produce fragile save/restore logic. Do Phase 5 first.
- **Full plugin registry for transforms** — the current four transforms are well-known; a dynamic registry adds indirection without value until a custom transform concept is planned.
- **Composer view** — the non-linear composer is valuable but the step components are not ready for it (they depend on wizard ordering). Phase 1 + Phase 5 are prerequisites.

### Tradeoffs accepted

- Keeping individual slice stores through Phase 4 means the "domain model gap" persists during the migration. The UX doesn't change until Phase 5, but the codebase is incrementally cleaner.
- The adapter pattern adds an indirection layer. A Kafka-only future would be simpler without it. The bet is that a second source (HTTP, S3, OTLP expansion) makes the adapter pay for itself.

---

## 10. Concrete Refactoring Recommendations

### Priority 1 — Remove six-place step registration
- File: `src/config/step-registry.ts` (new)
- Collapse `StepKeys`, `stepsMetadata`, `componentsMap`, `STEP_RENDERER_CONFIG`, `sidebarStepConfig`, and `DEPENDENCY_GRAPH.stepNodeMap` into one `StepDescriptor[]`
- Action: Both wizard and standalone shells consume the registry

### Priority 2 — Eliminate cross-slice writes via `get() as any`
- `topics.store.ts:83–98` — `invalidateTopicDependentState` should emit an event or call a domain-level `onSourceChanged()` function, not reach into `joinStore` and `deduplicationStore` directly
- `core.ts:222` — `getComputedOperation()` should read from `domainStore` not `deduplicationStore`/`joinStore`
- Action: Create a `src/store/cross-slice-effects.ts` that wires the cross-slice side effects in one place (subscribe pattern)

### Priority 3 — Single Go-duration parser
- Consolidate `hydrateGoToDuration` / `durationToMs` / `parseDurationToMs` into `src/utils/duration.ts`
- Action: Delete duplicates in `topics.ts`, `clickhouse-destination.ts`, `join-configuration.ts`

### Priority 4 — Canonical `SchemaField` and single type-conversion path
- Create `src/types/schema.ts` with `SchemaField`, `FieldType`
- Create `src/utils/type-conversion.ts` with `jsonTypeToClickHouseType()`, `clickHouseTypeToJsonType()`, `normalizeFieldType()`
- Delete: `getDefaultClickHouseType`, `mapClickHouseTypeToJsonType`, `inferJsonType` from their current locations
- Replace `useClickhouseMapperEventFields` (609 lines) with a `SchemaService.getEffectiveSchema(domain)` function called once

### Priority 5 — `enterCreateMode` sourceType bug
- `enterCreateMode()` in `core.ts:382–394` spreads `initialCoreStore` which resets `sourceType` to `'kafka'`
- Fix: pass the intended `sourceType` as an argument to `enterCreateMode(sourceType: SourceType)`
- Remove the ~10 defensive workarounds downstream that exist because of this bug

### Priority 6 — Split `buildInternalPipelineConfig` (928-line file)
- Extract `src/adapters/source/kafka/configBuilder.ts` — Kafka-specific fields
- Extract `src/adapters/source/otlp/configBuilder.ts` — OTLP-specific fields
- Extract `src/adapters/sink/clickhouse/configBuilder.ts` — ClickHouse-specific fields
- Keep `buildInternalPipelineConfig` as a thin orchestrator that delegates to adapters

### Priority 7 — Finish or remove the validation engine
- `src/store/state-machine/dependency-graph.ts` + `validation-engine.ts` is incomplete (Kafka-only, TODOs throughout)
- Either: extend it to cover all sources and all steps, make it the authority, remove the three parallel validation-state lookups
- Or: remove it entirely and consolidate validation into per-slice `validate()` methods + a domain-level `PipelineDomain.validate()` call

### Priority 8 — Design-time / runtime state split
- Move `pipeline_status`, `created_at`, `updated_at`, `pipeline_id` out of `coreStore` into `pipelineDeploymentStore`
- Reserve `coreStore` for design-time configuration only
- This is a prerequisite for a clean observability UI addition

---

## 11. Folder / Module Structure

Target structure after all phases:

```
src/
├── types/
│   ├── pipeline.ts          # Pipeline, PipelineDomain (shared domain types)
│   ├── schema.ts            # SchemaField, FieldType, SchemaRegistry (NEW)
│   ├── validation.ts        # ValidationState, ValidationResult
│   └── adapters.ts          # SourceAdapter, SinkAdapter, TransformPlugin interfaces (NEW)
│
├── adapters/
│   ├── source/
│   │   ├── index.ts         # getSourceAdapter(type) factory
│   │   ├── kafka/
│   │   │   ├── adapter.ts   # KafkaSourceAdapter implements SourceAdapter
│   │   │   ├── configBuilder.ts
│   │   │   └── hydrator.ts
│   │   └── otlp/
│   │       ├── adapter.ts
│   │       └── hydrator.ts
│   ├── sink/
│   │   ├── index.ts
│   │   └── clickhouse/
│   │       ├── adapter.ts   # ClickHouseSinkAdapter implements SinkAdapter
│   │       ├── configBuilder.ts
│   │       └── hydrator.ts
│   ├── transform/
│   │   ├── index.ts         # TransformPlugin registry
│   │   ├── deduplication/
│   │   ├── join/
│   │   ├── filter/
│   │   └── stateless/
│   └── wire/
│       ├── v3.ts            # V3 wire format adapter (hydrate/generate)
│       └── factory.ts
│
├── config/
│   ├── step-registry.ts     # Single StepDescriptor[] source of truth (NEW)
│   ├── constants.ts         # StepKeys enum (kept for backward compat during migration)
│   └── source-types.ts
│
├── store/
│   ├── index.ts             # Root store composition
│   ├── core.ts              # PipelineConfigStore (design-time domain)
│   ├── deployment.store.ts  # PipelineDeploymentStore (status, id, version) (NEW)
│   ├── runtime.store.ts     # PipelineRuntimeStore (observability, future) (NEW)
│   ├── steps.store.ts       # Wizard navigation state only
│   ├── notifications.store.ts
│   └── hydration/           # Per-section hydrators (delegate to adapters)
│
├── utils/
│   ├── duration.ts          # Single Go-duration parser (NEW, removes duplicates)
│   └── schema.ts            # SchemaService.getEffectiveSchema() (NEW)
│
└── modules/
    ├── create/              # Wizard shell — reads step-registry, drives PipelineDomain
    ├── compose/             # Composer shell — future (reads same step-registry)
    ├── ai/                  # AI-assisted flow — materializeIntentToStore → PipelineDomain
    ├── pipelines/           # Pipeline list, details, edit shell
    ├── kafka/               # Kafka step components (no business logic, delegates to adapter)
    ├── otlp/                # OTLP step components
    ├── clickhouse/          # ClickHouse step components
    ├── transformations/     # All transform step components
    └── review/              # Review and deploy
```

---

## 12. Testing Strategy

### Unit tests (highest value)

- **`SchemaService.getEffectiveSchema()`** — deterministic function, easy to test. Cover: source-only schema, source + one transform, source + two chained transforms, OTLP schema, join schema.
- **Type conversion functions** — `jsonTypeToClickHouseType()`, `clickHouseTypeToJsonType()`, roundtrip property tests.
- **`SourceAdapter.toWireFormat()` / `fromWireFormat()`** — roundtrip tests for each auth mechanism. These are the most regression-prone today.
- **`TransformPlugin.getOutputSchema()`** — each plugin should have unit tests for schema transformation.
- **`PipelineAdapter.generate()` / `hydrate()`** — roundtrip tests using real pipeline JSON fixtures. These already exist partially in `deduplication.store.test.ts`; expand to cover all config shapes.
- **`duration.ts`** — unit tests for all Go duration format edge cases.

### Integration tests

- **Hydration → generate roundtrip**: load a V3 pipeline fixture, hydrate the store, generate API config, assert it matches the original (or a known-good serialization).
- **Wizard step transitions**: use React Testing Library to simulate completing steps and assert store state and navigation outcomes.

### E2E / manual verification gates

At each migration phase, manually verify:
- Wizard create flow: Kafka single topic, Kafka join, OTLP
- Edit flow: open an existing pipeline, edit a section, save, discard
- YAML import/export roundtrip
- AI chat flow if AI branch is merged

### What to avoid

- **Testing UI rendering logic** (which variant of a component appears) — too brittle, low signal.
- **Snapshot tests for wizard step arrays** — they break on every journey change and don't catch real bugs.
- **Mocking stores in component tests** — test the store with real state, mock only network calls.

---

## 13. Open Questions

1. **Is a second source type (e.g., HTTP Ingest, S3) planned in the next 6 months?** If yes, the `SourceAdapter` pattern is mandatory and should be Phase 1. If no, the abstraction can wait until it's needed.

2. **Will the composer view support mixed sources in one pipeline?** (e.g., Kafka + HTTP feeding separate branches.) If yes, the `sources: Source[]` collection model is required now. If no, `topicCount` can survive Phase 1.

3. **What is the persistence model for saved connections?** Should the UI own a `localStorage` / IndexedDB cache, or will the backend add a `connections` resource? The answer determines where `SavedConnectionStore` lives and how it's hydrated.

4. **What is the target schema for the observability UI?** Knowing the data shape (e.g., Prometheus time-series, structured log events, aggregated metrics) would let `pipelineRuntimeStore` be designed correctly before the observability work starts.

5. **Is the `DEPENDENCY_GRAPH` in `validation-engine.ts` actively maintained?** If yes, it should be finished (add OTLP, filter, transformation nodes). If no, it should be removed to reduce cognitive load. Its current half-done state is a trap for future contributors.

6. **Should `PipelineDomain.validate()` be the canonical validator?** Currently, validation is spread across `useStepValidationStatus`, `validationEngine.onSectionConfigured`, and per-step local validation. Centralizing in the domain model would make AI flow and composer validation automatic — but requires migrating all the per-step validation logic.

7. **How should draft pipelines be stored?** If a user starts a wizard, closes the tab, and returns — should the in-progress config be recoverable? The current `sessionStorage` hydration cache (`HYDRATION_CACHE_KEY`) covers only loaded pipelines, not in-progress creation.

8. **What is the testing policy for type conversion roundtrips?** The current `deduplication.store.test.ts` file suggests there is appetite for store-level tests, but the most fragile path (source config → wire format → hydrate back → compare) is not tested. Establishing this as a CI gate would prevent the type-conversion drift that currently exists across the three conversion functions.

---

*Analysis based on codebase snapshot: April 2026, branch `ui-architecture-2.0`.*
*Explored files: `src/store/**`, `src/modules/create/**`, `src/modules/pipeline-adapters/**`, `src/modules/clickhouse/**`, `src/modules/kafka/**`, `src/modules/pipelines/**`, `src/app/ui-api/**`, `src/config/**`, `src/types/**`, `src/hooks/**`.*
