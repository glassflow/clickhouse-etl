# Pipeline Creation Wizard

## Overview

The Pipeline Creation Wizard (`create` module) guides users through configuring a new pipeline step-by-step. The flow is driven by **topic count** (1 or 2 topics), which determines the **journey**—the ordered list of steps. Navigation state is stored in `stepsStore`; each step is represented as a **step instance** with a stable id so that repeated step keys (e.g. topic selection or deduplication per topic) are uniquely identifiable.

This document describes the wizard UI, step model, navigation state, and **resume-to-last-editing** behavior (including handling of destructive changes).

## Key Files

| File                                                   | Purpose                                                                                                                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/create/PipelineWizard.tsx`                | Main wizard container: journey, sidebar, current step content, handleNext, handleSidebarStepClick.                                                                                                    |
| `src/modules/create/WizardSidebar.tsx`                 | Sidebar: step list (main + substeps), completed/active/pending state, click to navigate to completed steps only.                                                                                      |
| `src/modules/create/utils.ts`                          | Journey builders (`getWizardJourneyInstances`, `getSingleTopicJourney`, `getTwoTopicJourney`), sidebar from instances (`getSidebarStepsFromInstances`), step–component map (`getWizardJourneySteps`). |
| `src/modules/create/hooks/useStepValidationStatus.ts`  | Hook to get validation status for any step from corresponding store. Maps step keys to store validation states.                                                                                       |
| `src/modules/create/hooks/useWizardSmartNavigation.ts` | Hook for smart continue and sidebar navigation logic. Handles resume-to-last-editing, blocking step detection, and completed step pruning.                                                            |
| `src/store/steps.store.ts`                             | Wizard navigation state: `activeStepId`, `completedStepIds`, `resumeStepId`; actions to set/clear resume and prune completed steps.                                                                   |
| `src/config/constants.ts`                              | `StepKeys`, `stepsMetadata` (titles, descriptions).                                                                                                                                                   |

## Step Model

### Journey and step instances

- **Journey:** Ordered array of **step instances** for the current `topicCount`. Built by `getWizardJourneyInstances(topicCount)` from `utils.ts` (single-topic vs two-topic journey).
- **Step instance:** `{ id: string, key: StepKeys, topicIndex?: number }`. The `id` is stable per occurrence (e.g. `kafka-connection-0`, `deduplication-configurator-0`, `topic-selection-1-1`).
- **Sidebar steps:** Derived from the journey via `getSidebarStepsFromInstances(currentJourney, topicCount)`; includes hierarchy (main steps vs substeps) for display.

### Step keys and components

Step components are mapped in `utils.ts` (`componentsMap` / `getWizardJourneySteps`). Examples: `KAFKA_CONNECTION` → KafkaConnectionContainer, `TOPIC_SELECTION_1`/`TOPIC_SELECTION_2` → KafkaTopicSelector, `CLICKHOUSE_MAPPER` → ClickhouseMapper, `REVIEW_CONFIGURATION` → ReviewConfiguration. The wizard renders only the **current** step (by `activeStepId`); there is no draft persistence—unsaved form state on a step can be lost when navigating away.

## Navigation State (`stepsStore`)

| State              | Type             | Meaning                                                                                                                                                                                         |
| ------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeStepId`     | `string \| null` | Step instance id currently shown in the main content.                                                                                                                                           |
| `completedStepIds` | `string[]`       | Step instance ids the user has completed (clicked Continue). Used for sidebar state (completed vs active vs pending) and for allowing sidebar clicks only to completed steps.                   |
| `resumeStepId`     | `string \| null` | When the user navigates **backwards** to a completed step, this stores the step they left (the "last editing step"). Used by **Smart Continue** to decide where to go when they press Continue. |

### Actions

- `setActiveStepId(id)`, `setCompletedStepIds(ids)`, `addCompletedStepId(id)` — usual progression.
- `setResumeStepId(id)`, `clearResumeStepId()` — manage resume target.
- `removeCompletedStepsAfterId(instanceId, journeyInstanceIds)` — prune `completedStepIds` so only steps up to and including `instanceId` remain completed; used when a destructive change invalidates downstream steps.

## Navigation Hooks

The smart navigation logic is encapsulated in dedicated hooks for better testability and separation of concerns.

### `useStepValidationStatus`

Returns a function to get the validation status for any step key.

```typescript
const { getValidationStatus } = useStepValidationStatus()
const status = getValidationStatus(StepKeys.KAFKA_CONNECTION)
// status: 'not-configured' | 'valid' | 'invalidated'
```

**Mapping (StepKeys → store):**

- `KAFKA_CONNECTION` → `kafkaStore.validation.status`
- `TOPIC_SELECTION_1`, `TOPIC_SELECTION_2`, `KAFKA_TYPE_VERIFICATION` → `topicsStore.validation.status`
- `DEDUPLICATION_CONFIGURATOR` → `deduplicationStore.validation.status`
- `FILTER_CONFIGURATOR` → `filterStore.validation.status`
- `TRANSFORMATION_CONFIGURATOR` → `transformationStore.validation.status`
- `JOIN_CONFIGURATOR` → `joinStore.validation.status`
- `CLICKHOUSE_CONNECTION` → `clickhouseConnectionStore.validation.status`
- `CLICKHOUSE_MAPPER` → `clickhouseDestinationStore.validation.status`
- `REVIEW_CONFIGURATION`, `DEPLOY_PIPELINE` → always returns `'valid'` (non-blocking)

### `useWizardSmartNavigation`

Handles smart continue and sidebar navigation logic.

```typescript
const { handleSmartContinue, handleSidebarNavigation, findBlockingStep } = useWizardSmartNavigation({
  journey: currentJourney,
  activeStepId,
  resumeStepId,
  completedStepIds,
  getValidationStatusForStep: getValidationStatus,
  setActiveStepId,
  addCompletedStepId,
  setCompletedStepIds,
  setResumeStepId,
  clearResumeStepId,
  removeCompletedStepsAfterId,
})
```

**`handleSmartContinue()`** - Returns `{ nextStepId, shouldRouteAway?, currentStepKey? }`:

- Determines whether to navigate to next step, blocking step, or resume target
- Handles Review step routing (returns `shouldRouteAway: true`)
- Prunes completed steps when a blocking step is found

**`handleSidebarNavigation(targetStepId)`** - Manages resume target:

- Sets `resumeStepId` when navigating backwards (if not already set)
- Clears `resumeStepId` when navigating forwards
- Sets the active step

**`findBlockingStep(fromIndex, toIndex)`** - Returns the first blocking step instance or null:

- Searches steps between fromIndex (exclusive) and toIndex (inclusive)
- A step is blocking if validation status is not `'valid'`

## Navigation Behavior

### Forward (Continue)

- User clicks **Continue** on the current step → `handleNext()` runs.
- The current step is added to `completedStepIds` (if not already there).
- **Review step:** On Continue from `REVIEW_CONFIGURATION`, the app navigates to `/pipelines/`; no change to "resume" logic.
- **Smart Continue (resume):** If `resumeStepId` is set and its index in the journey is **after** the current step:
  - The wizard scans steps **between** (current + 1) and **resume** (inclusive) via `findBlockingStep`. A step is **blocking** if status is not `valid` (e.g. `invalidated` or `not-configured`).
  - If a **blocking** step is found: navigate to that step (earliest invalidated downstream step), call `removeCompletedStepsAfterId(step before blocking, journeyIds)` so the sidebar no longer shows later steps as completed, then `clearResumeStepId()`.
  - If **no** blocking step: navigate directly to `resumeStepId`, then `clearResumeStepId()`.
- **Normal forward:** If there is no resume or resume is not ahead, advance to `currentJourney[index + 1]`.
- **Stale resume:** If `resumeStepId` is set but not in the journey or not ahead of current (e.g. journey changed), `clearResumeStepId()` and then proceed with normal forward.

### Backward (sidebar)

- Only **completed** steps are clickable in the sidebar (`handleSidebarStepClick`).
- When the user clicks a completed step (handled by `handleSidebarNavigation`):
  - If the clicked step is **before** the current step (backward): set `resumeStepId = activeStepId` (the step they're leaving), unless `resumeStepId` is already set (so going further back keeps the original "where I left off").
  - If the user clicks forward or the same step and a resume was set: `clearResumeStepId()`.
  - Then set `activeStepId` to the clicked step.

### Destructive vs non-destructive

- **Non-destructive:** User goes back, edits a previous step, and the change does not invalidate any downstream store (e.g. only label or non-structural change). On Continue, they are taken back to **resumeStepId** (last editing step).
- **Destructive:** A change invalidates a downstream step (e.g. topic/schema change invalidates deduplication or ClickHouse mapping). Those stores set `validation.status = 'invalidated'`. On Continue, the wizard routes to the **earliest invalidated** step in the journey and prunes `completedStepIds` so the sidebar no longer shows later steps as completed; the user must re-complete from that point. Invalidation is triggered by step components / stores (e.g. topic submit, join config change, ClickHouse connection change), not by the wizard itself.

## Non-goals

- **Draft persistence:** In-progress edits on a step (before clicking Continue) are not persisted when navigating away; the wizard does not save "drafts" per step. Only the **resume target** (which step to return to) is remembered.

## Related

- Steps store: `src/store/steps.store.ts`
- Journey and step keys: `src/config/constants.ts` (`StepKeys`, `stepsMetadata`), `src/modules/create/utils.ts`
- Validation engine (used by step components to mark valid/invalidated): `src/store/state-machine/validation-engine.ts`
- Docs index: [docs/README.md](../../README.md)
