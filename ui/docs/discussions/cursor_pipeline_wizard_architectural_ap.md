# Pipeline wizard architectural approach
_Exported on 1/30/2026 at 13:37:15 GMT+1 from Cursor (2.4.23)_

---

**User**

Analyze the @clickhouse-etl/ui/src/modules/create/PipelineWizard.tsx  module which is used in the pipelines/create route. That wizard is used to create pipelines, walking the user through a series of steps where they provide necessary information to compose the final pipeline configuration. This configuration is then handed over to the back-end to instantiate and run that pipeline. I want to know if this approach with one component that has a complex state and transitions and interactions is a good approach or should I resort to having individual pages for each and every step? Would that be better for me or not? So I want to hear your take on this architectural approach

---

**Cursor**

I’ll first read the wizard and its route wrapper to understand how steps, state, validation, and navigation are currently implemented. Then I’ll map the complexity hotspots (state shape, side effects, transitions), and give a tradeoff-based recommendation: keep a single wizard (but refactor) vs split into per-step pages (route-driven).

## What your current wizard is doing (and why it feels “complex”)

`PipelineWizard.tsx` is a **single route-level orchestrator** that:
- Picks a “journey” (ordered list of steps) based on `topicCount` (`getSingleTopicJourney()` / `getTwoTopicJourney()`) and renders the active step component.  
- Tracks navigation with **global store state** (`activeStep`, `completedSteps`) plus some **local state** for “editing” and disambiguation (`editingStep`, `previousActiveStep`, `deduplicationParent`).  
- Contains non-trivial logic for **duplicate steps** (same `StepKeys` appearing multiple times in the journey), especially for deduplication + type verification steps.

The complexity is very visible in a few places:
- **Duplicate-step disambiguation + navigation**:

```60:135:clickhouse-etl/ui/src/modules/create/PipelineWizard.tsx
const handleNext = (stepName: StepKeys) => {
  // ... findCorrectOccurrence for duplicates ...
  // ... addCompletedStep, compute nextStep from journey ...
  // ... deduplicationParent heuristics ...
}
```

- **“Which topic is this step for?” inference** (backtracking through the journey + completion state):

```165:240:clickhouse-etl/ui/src/modules/create/PipelineWizard.tsx
const getTopicIndexForStep = (stepKey: string, activeStepKey: string): number => {
  // ... parent overrides ...
  // ... find occurrences, infer which one is active ...
  // ... fallback based on TOPIC_SELECTION_2 completion ...
}
```

- **Special cases wired into the orchestrator** (props differences per step type, redirect behavior):

```242:299:clickhouse-etl/ui/src/modules/create/PipelineWizard.tsx
// renderStepComponent has step-specific prop wiring and special handling
```

So: the “one component with complex state & transitions” approach is not inherently wrong—but in *your* code, a big chunk of complexity is coming from **modeling step occurrences with only a single `StepKeys` identifier**.

---

## Is a single wizard component a good approach?

### When it’s a good approach (and you’re already close)
A single wizard route with an orchestrator component is usually the right default when:
- **Steps share a single accumulating draft** (pipeline config), which you already imply.
- You want **fast step-to-step transitions** without route churn.
- You want a **single place** to enforce “can’t proceed until valid” and “review at end”.
- You expect to reuse the wizard inside other flows (modal → wizard, etc.).

This approach is common and can be very maintainable *if* the transitions are modeled cleanly.

### Where your current implementation is paying extra cost
The cost isn’t “single component” per se—it’s that the wizard is encoding a lot of **implicit state machine rules** in ad-hoc logic (duplicate step keys, backtracking, “parent step” heuristics). That makes it harder to:
- Reason about correctness (especially around editing a completed duplicate step)
- Add new steps or reorder journeys safely
- Test transitions deterministically

---

## Would “one page per step” be better?

Per-step pages (route-driven wizard) are better **only if you need route semantics**. You’d typically choose it when you want:
- **Deep linking / shareable URLs** to a step (including “edit step X” links)
- **Refresh resiliency** (reload keeps you on the same step without relying on client store persistence)
- Proper **browser back/forward behavior** for step navigation
- Better **analytics / tracking** per step via route changes
- Potential **code splitting** benefits on large steps

But route-driven steps also bring real overhead:
- You still need a **shared draft store** (you already have one), plus guards for skipping ahead.
- You must handle **invalid navigation** (typing `/pipelines/create/review` before prerequisites).
- More plumbing to keep the sidebar + completion state consistent across pages.

So “individual pages for each and every step” is not automatically more maintainable—it’s a trade.

---

## My take for *this* codebase: keep one wizard route, but change the model

Given what’s in `PipelineWizard.tsx`, I would **not jump straight to per-step pages** as the primary fix. The biggest win will come from **making the step identity explicit**, so you can delete most of the deduplication heuristics.

### The core improvement: stop using duplicate `StepKeys` as identity
Instead of a journey like:

- `[TOPIC_SELECTION_1, ..., DEDUPLICATION_CONFIGURATOR, ..., TOPIC_SELECTION_2, ..., DEDUPLICATION_CONFIGURATOR, ...]`

use **step instances**, e.g.:

- `[{ key: TOPIC_SELECTION, topicIndex: 0 }, ..., { key: DEDUPLICATION_CONFIGURATOR, topicIndex: 0 }, ..., { key: TOPIC_SELECTION, topicIndex: 1 }, ..., { key: DEDUPLICATION_CONFIGURATOR, topicIndex: 1 }]`

Then:
- `activeStep` becomes an **instance id** (or `{key, topicIndex}`), not just `StepKeys`.
- `completedSteps` tracks instances, not keys.
- `getTopicIndexForStep()` and `deduplicationParent` basically disappear.
- Sidebar clicks can target the exact instance without ambiguity.

This keeps your “single wizard component” approach but removes the main source of complexity.

### Optional: add URL state without splitting into pages
If you want refresh/back/deep links *without* per-step pages, you can store the active step in:
- query params (e.g. `?step=DEDUPLICATION_CONFIGURATOR&topic=1`) or
- a route segment (e.g. `/pipelines/create/deduplication?topic=1`) while still rendering a single orchestrator component.

That gives you the best benefits of routing without fragmenting the wizard into many page files.

---

## Practical decision guide (quick)

- **Stay single wizard (recommended for you)** if: users always come from the create flow, you don’t need shareable step URLs, and you want simple UX. Refactor to step instances/state-machine-like transitions.
- **Move to per-step pages** if: you strongly need deep-linking, refresh/back-button correctness, or you want steps to behave like independently navigable “screens.”

Right now, your pain is coming from **transition/identity modeling**, not from the fact it’s “one component.” Fixing that model will likely make the code dramatically simpler than a routing rewrite.

---

**User**

Look at this segment here:

// Determine the current journey based on topic count
  const currentJourney = React.useMemo(() => {
    if (topicCount === 1) {
      return getSingleTopicJourney()
    } else if (topicCount === 2) {
      return getTwoTopicJourney()
    }
    return []
  }, [topicCount]), 

it's on line 20 in the @clickhouse-etl/ui/src/modules/create/PipelineWizard.tsx , it is establishing what kind of journey do we have here, based on the number of topics selected. We're using memo here, to memoize this calculation. My question is is it smart to keep that information here as memoized calculation based on the number of topics or we could externalize that logic somewhere, for example, have some module with business layer that determines steps and journeys, and then in the previous screen, when user selects the number of topics, we give that information to that independent module, which then creats journey steps and stores it in the state. That way this module could just read the journey information, right? I want to hear your reasoning here.

---

**Cursor**

I’m going to look at how journeys/steps are currently defined (in `wizard-utils`) and how your state store is structured, so I can compare “derive locally via memo” vs “precompute and store in state” in the context of your app’s actual patterns.

I’m missing a couple files by name (`wizard-utils.ts`, `stepsStore.ts`)—looks like they’re named slightly differently in this repo. I’ll quickly locate the actual filenames and read them so the recommendation matches your current architecture.

## What you have today

`PipelineWizard` derives a “journey” from `topicCount`:

```27:35:clickhouse-etl/ui/src/modules/create/PipelineWizard.tsx
const currentJourney = React.useMemo(() => {
  if (topicCount === 1) {
    return getSingleTopicJourney()
  } else if (topicCount === 2) {
    return getTwoTopicJourney()
  }
  return []
}, [topicCount])
```

Those journey functions already live outside the component in `src/modules/create/utils.ts` and they embed **business rules + feature flags**:

```147:202:clickhouse-etl/ui/src/modules/create/utils.ts
export const getSingleTopicJourney = (): StepKeys[] => {
  const steps: StepKeys[] = [
    StepKeys.KAFKA_CONNECTION,
    StepKeys.TOPIC_SELECTION_1,
    StepKeys.KAFKA_TYPE_VERIFICATION,
    StepKeys.DEDUPLICATION_CONFIGURATOR,
  ]

  if (isFiltersEnabled()) {
    steps.push(StepKeys.FILTER_CONFIGURATOR)
  }

  if (isTransformationsEnabled()) {
    steps.push(StepKeys.TRANSFORMATION_CONFIGURATOR)
  }

  steps.push(StepKeys.CLICKHOUSE_CONNECTION, StepKeys.CLICKHOUSE_MAPPER)

  if (isPreviewModeEnabled()) {
    steps.push(StepKeys.REVIEW_CONFIGURATION)
  }

  return steps
}
```

So you’ve *already* externalized the actual journey determination; the wizard is mostly selecting which one to use.

---

## Should you “precompute journey elsewhere and store it” vs derive it here?

### My recommendation: **derive it (don’t store it)**, but be intentional about *where*
In general, **don’t store derived state** if you can store the minimal inputs (`topicCount`, flags, operation type) and compute the output (journey) when needed. Storing the journey array in Zustand would introduce:
- **Duplication / drift risk**: now `topicCount` and `journey` can get out of sync unless you rigorously update both on every path (reset, edit mode, hydration, etc.).
- **More invalidation complexity**: if feature flags change, or you later add “operation-type-driven” journeys, you need to decide whether stored journeys should update or stay as a snapshot.
- **Bigger state surface area**: more things to reset; more bugs around “where did this journey come from?”

Given how small the computation is (building a short array), you don’t need caching for performance.

### When storing a journey *does* make sense
It becomes reasonable if the journey is:
- **User-editable** (the user chooses a flow and you want that choice frozen even if other inputs change),
- **Fetched from the backend** (server decides steps per tenant, plan, permissions),
- **A snapshot you must preserve** (e.g., “this pipeline was created under flags X/Y, keep that experience consistent”).

Even then, I’d often store a **journey key / version** (inputs) rather than the whole array.

---

## Specific nuance about `useMemo` here

### `useMemo` isn’t wrong, but it’s not buying you much
The “cost” of `getSingleTopicJourney()` / `getTwoTopicJourney()` is trivial. The only real benefit of memoization here is **referential stability** (same array instance) to reduce downstream re-renders or keep equality checks stable.

### But: your journey depends on more than `topicCount`
In `utils.ts`, journeys depend on `isPreviewModeEnabled()`, `isFiltersEnabled()`, `isTransformationsEnabled()`. If those flags can ever change during a session, then this memo:

- can return a **stale journey** because dependencies only include `topicCount`.

If flags are truly static per build/session, it’s fine. If they’re dynamic, the simplest fix is: **don’t memoize at all** (or include flag values in deps).

---

## Where to put the logic, practically

- **Good as-is**: keep journeys as pure functions in `src/modules/create/utils.ts` (you already do), and have `PipelineWizard` “select” the right journey based on store inputs.
- **If you want it cleaner**: create a single selector function like `getJourneyForTopicCount(topicCount)` (still in `utils.ts`) so the wizard doesn’t need branching logic—but still *derives*, not *stores*.
- **Avoid**: computing journey in the previous screen and persisting the array in the store unless you have a concrete requirement for snapshotting/back-forward/deep links.

So: yes, it’s “smart” to derive journey from `topicCount` in the wizard; what I’d watch out for is the **feature-flag dependency** vs the `useMemo` dependency list, not the location of the branching itself.

---

**User**

I want now to better understand handleNext function which acts as a handler for the continue button in step component. I want to understand would this logic become simpler if we introduced proposal that you had at the start of our conversation about removign depedency on the step keys and introduce step instances and pass along actuall instances?

---

**Cursor**

## What `handleNext` is doing today (and why it’s complicated)

Here’s the core of `handleNext`:

```60:135:clickhouse-etl/ui/src/modules/create/PipelineWizard.tsx
const handleNext = (stepName: StepKeys) => {
  // Find the index of the CURRENTLY ACTIVE step in the journey
  // For duplicate step keys (like DEDUPLICATION_CONFIGURATOR or KAFKA_TYPE_VERIFICATION), find the correct occurrence
  let currentStepIndex = currentJourney.indexOf(currentActiveStep as StepKeys)

  // Helper function to find correct occurrence for duplicate steps
  const findCorrectOccurrence = (stepKey: StepKeys): number => {
    const stepIndices: number[] = []
    currentJourney.forEach((step, index) => {
      if (step === stepKey) {
        stepIndices.push(index)
      }
    })

    // Determine which occurrence we're on based on completed steps or parent info
    if (deduplicationParent === StepKeys.TOPIC_SELECTION_2 && stepIndices.length > 1) {
      return stepIndices[stepIndices.length - 1] // Second occurrence
    } else if (completedSteps.includes(StepKeys.TOPIC_SELECTION_2) && stepIndices.length > 1) {
      return stepIndices[stepIndices.length - 1] // Second occurrence
    } else if (stepIndices.length > 0) {
      return stepIndices[0] // First occurrence
    }
    return currentStepIndex
  }

  // Handle duplicate step keys
  if (
    (currentActiveStep === StepKeys.DEDUPLICATION_CONFIGURATOR ||
      currentActiveStep === StepKeys.KAFKA_TYPE_VERIFICATION) &&
    currentStepIndex !== -1
  ) {
    currentStepIndex = findCorrectOccurrence(currentActiveStep as StepKeys)
  }

  if (currentStepIndex !== -1) {
    // Mark the current step as completed
    addCompletedStep(currentActiveStep as StepKeys)

    // Handle special case for review configuration
    if (stepName === StepKeys.REVIEW_CONFIGURATION) {
      setActiveStep(StepKeys.DEPLOY_PIPELINE)
      router.push('/pipelines/')
      return
    }

    // Set the next step as active (follow the journey array)
    const nextStep = currentJourney[currentStepIndex + 1]
    if (nextStep) {
      setActiveStep(nextStep)

      // If navigating TO a deduplication or type verification step, set the parent based on journey position
      if (nextStep === StepKeys.DEDUPLICATION_CONFIGURATOR || nextStep === StepKeys.KAFKA_TYPE_VERIFICATION) {
        // Find which topic selection step precedes this step
        for (let i = currentStepIndex; i >= 0; i--) {
          const prevStep = currentJourney[i]
          if (prevStep === StepKeys.TOPIC_SELECTION_1) {
            setDeduplicationParent(StepKeys.TOPIC_SELECTION_1)
            break
          } else if (prevStep === StepKeys.TOPIC_SELECTION_2) {
            setDeduplicationParent(StepKeys.TOPIC_SELECTION_2)
            break
          }
        }
      } else {
        // Clear deduplication parent when moving to non-deduplication/type-verification step
        setDeduplicationParent(null)
      }
    }
  }

  // Clear editing state if we were editing
  if (editingStep) {
    setEditingStep(null)
    setPreviousActiveStep(null)
  }
}
```

The complexity is *mostly* because `currentJourney` contains **duplicate `StepKeys`** (e.g. `KAFKA_TYPE_VERIFICATION` appears twice in the 2-topic journey, same for `DEDUPLICATION_CONFIGURATOR`), but `activeStep` and `completedSteps` track only **a string key**.

That forces you to invent “which occurrence am I on?” rules (`findCorrectOccurrence`, `deduplicationParent`, checking whether `TOPIC_SELECTION_2` is completed, scanning backwards in the journey, etc.).

There’s another structural pressure: your steps store only tracks completion by string, and won’t represent the same key twice cleanly:

```48:59:clickhouse-etl/ui/src/store/steps.store.ts
addCompletedStep: (step: string) => {
  set((state) => {
    if (!state.stepsStore.completedSteps.includes(step)) {
      return {
        stepsStore: {
          ...state.stepsStore,
          completedSteps: [...state.stepsStore.completedSteps, step],
        },
      }
    }
    return state
  })
},
```

So “complete deduplication step #1” and “complete deduplication step #2” collapse into the same string, which is why so much logic has to infer progress positionally.

---

## Would step instances make this simpler?

**Yes—dramatically, if you also change what you store as `activeStep`/`completedSteps`.** The simplification comes from giving each occurrence a unique identity, e.g.:

- `DEDUPLICATION_CONFIGURATOR:left` vs `DEDUPLICATION_CONFIGURATOR:right`, or
- an opaque `stepInstanceId` with metadata `{ key, topicIndex, order }`.

### What gets simpler immediately
With step instances:

- **No `findCorrectOccurrence`**: there’s only one active instance at a time, and it exists at exactly one index in the journey.
- **No `deduplicationParent`**: topic association becomes data (`instance.topicIndex`), not inference.
- **No backtracking/scanning to guess topic index**: you render `DeduplicationConfigurator` using `instance.topicIndex`.
- **Completion becomes correct and trivial**: `completedStepInstanceIds` can contain both dedup steps.

### What `handleNext` becomes
Conceptually:

- find current instance index in the journey (by id)
- mark that instance complete
- set active to journey[index + 1]?.id
- handle end-of-journey navigation

No special casing for “duplicate step keys”, because duplicates are now distinct instances.

---

## Important nuance: passing instances alone isn’t enough

If you merely “pass the instance into `handleNext`” but still keep `stepsStore.activeStep` as a `StepKeys` string, you’ll still need mapping logic and you’ll still have ambiguity.

The real payoff comes when:
- `activeStep` becomes **`activeStepId`** (instance id)
- `completedSteps` becomes **`completedStepIds`**
- `currentJourney` becomes an array of **instances**, not `StepKeys[]`

At that point `WizardSidebar` also gets much simpler, because it currently has duplicate-key completion logic too:

```25:90:clickhouse-etl/ui/src/modules/create/WizardSidebar.tsx
// For steps with duplicate keys (like DEDUPLICATION_CONFIGURATOR), check completion based on journey position
if (stepKey === 'deduplication-configurator' && journey && step.parent) {
  // ... find occurrences, infer which one is active using deduplicationParent/completedSteps ...
}
```

With instances, the sidebar can just check `completedStepIds.has(stepId)` and `activeStepId === stepId`.

---

## Bottom line

- **Yes, `handleNext` becomes much simpler** with step instances, because you stop encoding “which occurrence?” as implicit business logic.
- The simplification is biggest because your current store tracks completion by string key and can’t represent duplicates cleanly—instances fix that at the root.

If you want, I can sketch a concrete “step instance” data shape that fits your existing `StepKeys` and journeys in `src/modules/create/utils.ts` (including how to represent substeps like dedup/filter/transform under type verification).

