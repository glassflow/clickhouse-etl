# Pipeline Details Module Documentation

## Overview

The Pipeline Details module provides a comprehensive interface for viewing and managing a single pipeline's configuration, status, and metrics. It enables users to view pipeline details, navigate through configuration sections, edit pipeline settings, perform pipeline operations (stop, resume, terminate, delete, rename), and monitor pipeline health and performance.

## Architecture

### Component Hierarchy

```
PipelineDetailsModule (Main Container)
├── PipelineDetailsHeader
│   ├── Pipeline Name & Status (usePipelineDisplayStatus)
│   ├── Action Buttons (Stop, Resume, Edit, Rename, Delete)
│   ├── PipelineActionsMenu (Radix DropdownMenu)
│   │   ├── Secondary Actions
│   │   ├── Manage Tags
│   │   ├── Download Config
│   │   ├── Flush DLQ
│   │   └── Grafana Dashboard (if available)
│   ├── Tags Display
│   ├── Pipeline ID Copy
│   └── Health Status Indicator
│
├── PipelineDetailsSidebar (sidebar/sidebarItemBuilders)
│   ├── getSourceItems() - Kafka, Topics, Type Verification, Dedup
│   ├── getTransformationItems() - Join, Filter, Transformations
│   └── getSinkItems() - ClickHouse Connection, Destination
│
├── PipelineStatusOverviewSection
│   ├── DeadLetterQueueCard
│   └── ClickHouseTableMetricsCard
│
├── Configuration Overview (Monitor View)
│   ├── KafkaConnectionSection (Source)
│   ├── TransformationSection (transformation/)
│   │   ├── Cards: FilterCard, TypeVerificationCard, TransformationCard, DeduplicationKeyCard
│   │   └── Cases: DeduplicationCase, JoinCase, JoinDeduplicationCase, FallbackCase
│   └── ClickhouseConnectionSection (Sink)
│
└── StandaloneStepRenderer (step-renderer/)
    ├── STEP_RENDERER_CONFIG (stepRendererConfig.ts)
    ├── getStepProps (stepProps.ts)
    ├── useSafeEnterEditMode hook
    ├── Step Component
    ├── EditConfirmationModal
    └── PipelineTransitionOverlay
```

### Module Structure

```
modules/pipelines/[id]/
├── PipelineDetailsModule.tsx       # Main orchestrator
├── PipelineDetailsHeader.tsx       # Header with status and actions
├── PipelineDetailsClientWrapper.tsx # Client-side data fetching
├── PipelineDetailsSidebar.tsx      # Navigation sidebar
├── PipelineStatusOverviewSection.tsx
├── StandaloneStepRenderer.tsx      # Step rendering (refactored)
│
├── config/
│   └── pipeline-details.constants.ts  # Step sets, view state constants
│
├── hooks/
│   └── useActiveViewState.ts       # Active step/section/topicIndex state
│
├── header/
│   ├── index.ts
│   └── PipelineActionsMenu.tsx     # Radix-based dropdown menu
│
├── sidebar/
│   ├── index.ts
│   ├── sidebarItemBuilders.ts      # getSourceItems, getTransformationItems, getSinkItems
│   └── sidebarItemBuilders.test.ts # Unit tests
│
├── step-renderer/
│   ├── index.ts
│   ├── stepRendererConfig.ts       # STEP_RENDERER_CONFIG map
│   ├── stepProps.ts                # getStepProps, isTopicSelectorStep, etc.
│   └── useSafeEnterEditMode.ts     # Safe edit mode hook
│
├── sections/
│   ├── KafkaConnectionSection.tsx
│   ├── ClickhouseConnectionSection.tsx
│   ├── TransformationSection.tsx   # Refactored orchestrator
│   └── transformation/
│       ├── index.ts
│       ├── types.ts                # TransformationValidation, props interfaces
│       ├── utils.ts                # isDeduplicationEnabled, getTransformationTypeLabel
│       ├── cards/
│       │   ├── FilterCard.tsx
│       │   ├── TypeVerificationCard.tsx
│       │   ├── TransformationCard.tsx
│       │   └── DeduplicationKeyCard.tsx
│       └── cases/
│           ├── DeduplicationCase.tsx
│           ├── JoinCase.tsx
│           ├── JoinDeduplicationCase.tsx
│           └── FallbackCase.tsx
│
└── [Card Components]
    ├── SingleColumnCard.tsx
    ├── DoubleColumnCard.tsx
    ├── TitleCardWithIcon.tsx
    ├── DeadLetterQueueCard.tsx
    └── ClickHouseTableMetricsCard.tsx
```

## Core Components

### 1. PipelineDetailsModule

**Location:** `src/modules/pipelines/[id]/PipelineDetailsModule.tsx`

**Purpose:** The main container component that orchestrates the entire pipeline details view.

**Key Responsibilities:**
- Manages pipeline data state
- Handles pipeline hydration via `usePipelineHydration` hook
- Coordinates sidebar navigation and step rendering via `useActiveViewState` hook
- Manages edit mode and read-only mode
- Handles pipeline operations via centralized actions
- Provides sequential animations for UI elements
- Manages tags modal

**State Management:**
Uses the `useActiveViewState` hook to manage:
```typescript
interface ActiveViewState {
  activeSection: SidebarSection | null
  activeStep: StepKeys | null
  activeTopicIndex: number
}
```

**Pipeline Hydration:**
Delegated to `usePipelineHydration` hook (see Hooks section).

### 2. PipelineDetailsHeader

**Location:** `src/modules/pipelines/[id]/PipelineDetailsHeader.tsx`

**Purpose:** Displays pipeline header with name, status, actions, tags, and health information.

**Key Features:**
- Pipeline name and status badge (via `usePipelineDisplayStatus`)
- Primary action buttons (Stop, Resume, Edit, Rename, Delete)
- Actions menu via `PipelineActionsMenu` component
- Tags display and management
- Pipeline ID copy functionality
- Health status indicator
- Resume with pending edit flow (via `useResumeWithPendingEdit`)

**Status Display:**
Uses `usePipelineDisplayStatus` hook which returns:
```typescript
{
  variant: 'success' | 'warning' | 'error' | 'default'
  label: string
  effectiveStatus: PipelineStatus
}
```

### 3. PipelineActionsMenu

**Location:** `src/modules/pipelines/[id]/header/PipelineActionsMenu.tsx`

**Purpose:** Dropdown menu for secondary pipeline actions using Radix DropdownMenu.

**Features:**
- Uses Radix UI DropdownMenu for accessibility and positioning
- No manual portal/position calculations needed
- Actions: secondary pipeline actions, manage tags, download, flush DLQ, Grafana
- Supports demo mode disabling
- Shows unsaved changes warning badge on download

### 4. PipelineDetailsSidebar

**Location:** `src/modules/pipelines/[id]/PipelineDetailsSidebar.tsx`

**Purpose:** Provides navigation sidebar for pipeline configuration sections.

**Architecture:**
Uses modular item builders from `sidebar/sidebarItemBuilders.ts`:

```typescript
// Split into focused functions
getSourceItems(pipeline)        // Kafka, topics, type verification, dedup
getTransformationItems(pipeline) // Join, filter, transformations
getSinkItems()                   // ClickHouse connection, destination

// Combined
getSidebarItems(pipeline)        // Monitor + all sections
```

**Dynamic Item Generation:**
- Analyzes pipeline configuration
- Determines topic count (single vs multi)
- Checks for deduplication on each topic
- Checks for join configuration
- Checks for transformations
- Returns appropriate sidebar items with step keys and topic indices

### 5. TransformationSection

**Location:** `src/modules/pipelines/[id]/sections/TransformationSection.tsx`

**Purpose:** Displays visual representation of pipeline transformation configuration.

**Architecture:**
Refactored into modular structure:

```
sections/transformation/
├── types.ts        # TransformationValidation, base props interfaces
├── utils.ts        # isDeduplicationEnabled(), getTransformationTypeLabel()
├── cards/          # Individual card components
│   ├── FilterCard.tsx
│   ├── TypeVerificationCard.tsx
│   ├── TransformationCard.tsx
│   └── DeduplicationKeyCard.tsx
└── cases/          # Layout case components
    ├── DeduplicationCase.tsx      # Single topic
    ├── JoinCase.tsx               # Multi-topic with join
    ├── JoinDeduplicationCase.tsx  # Join + full dedup
    └── FallbackCase.tsx           # Edge cases
```

**Reactivity Fix:**
All components now use proper `useStore` selectors instead of `getState()`:
```typescript
// Before (no reactivity)
const dedup = useStore.getState().deduplicationStore.getDeduplication(0)

// After (proper reactivity)
const dedup = useStore((state) => state.deduplicationStore.getDeduplication(0))
```

### 6. StandaloneStepRenderer

**Location:** `src/modules/pipelines/[id]/StandaloneStepRenderer.tsx`

**Purpose:** Renders individual configuration steps in standalone mode.

**Architecture:**
Uses configuration-driven approach from `step-renderer/`:

```typescript
// stepRendererConfig.ts - Configuration map
const STEP_RENDERER_CONFIG: Record<StepKeys, StepConfig | undefined> = {
  [StepKeys.KAFKA_CONNECTION]: {
    component: KafkaConnectionContainer,
    title: 'Kafka Connection',
    description: 'Configure your Kafka connection settings',
  },
  // ... other steps
}

// stepProps.ts - Props utilities
getStepProps(stepKey, baseProps, topicIndex) // Returns extended props based on step type
isTopicSelectorStep(stepKey)                  // Checks if step needs currentStep prop
isTopicDeduplicationStep(stepKey)             // Checks if step is topic+dedup combined
needsIndexProp(stepKey)                       // Checks if step needs index prop

// useSafeEnterEditMode.ts - Edit mode hook
const { safeEnterEditMode, isInEditMode } = useSafeEnterEditMode()
```

**Benefits:**
- Adding a new step is a single entry in `STEP_RENDERER_CONFIG`
- No long if/else chains
- No nested ternaries for props
- Consistent edit mode handling

## Hooks

### usePipelineDetailsData

**Location:** `src/hooks/usePipelineDetailsData.ts`

**Purpose:** Centralized pipeline data fetching with loading/error/notFound states.

```typescript
const {
  pipeline,
  loading,
  error,
  isNotFound,
  refetch,
  setPipeline,
} = usePipelineDetailsData(pipelineId, { skipInitialFetch })
```

### usePipelineHydration

**Location:** `src/hooks/usePipelineHydration.ts`

**Purpose:** Handles pipeline hydration from API to stores.

**Features:**
- Creates cache key from pipeline ID, name, status, topics, version
- Checks sessionStorage for previous hydration
- Verifies store has data (handles page reloads)
- Gets appropriate pipeline adapter based on version
- Converts API config to internal config via adapter
- Calls `enterViewMode` to hydrate stores

### usePipelineDisplayStatus

**Location:** `src/hooks/usePipelineDisplayStatus.ts`

**Purpose:** Derives display status (variant, label) from pipeline state.

```typescript
const { variant, label, effectiveStatus } = usePipelineDisplayStatus(
  pipeline,
  health,
  actionState
)
```

### useResumeWithPendingEdit

**Location:** `src/hooks/useResumeWithPendingEdit.ts`

**Purpose:** Handles resume action when there are unsaved edits.

**Flow:**
1. Checks `isDirty` flag
2. Builds API config from stores
3. Calls edit action
4. Resets stores
5. Clears hydration cache
6. Fetches updated pipeline

### useActiveViewState

**Location:** `src/modules/pipelines/[id]/hooks/useActiveViewState.ts`

**Purpose:** Manages active view state (section, step, topic index).

```typescript
const {
  activeSection,
  activeStep,
  activeTopicIndex,
  setActiveView,
  clearActiveStep,
} = useActiveViewState()
```

### useSafeEnterEditMode

**Location:** `src/modules/pipelines/[id]/step-renderer/useSafeEnterEditMode.ts`

**Purpose:** Safely enters edit mode without overwriting unsaved changes.

```typescript
const { safeEnterEditMode, isInEditMode, globalMode } = useSafeEnterEditMode()

// Only enters if not already in edit mode
safeEnterEditMode(pipeline)
```

## Type System

### Type Hierarchy

```typescript
// Raw API response (any version)
type PipelineApiResponse = any

// Normalized pipeline structure
interface Pipeline {
  pipeline_id: string
  name: string
  version?: string
  status?: PipelineStatus
  source: { ... }
  sink: { ... }
  // ...
}

// Extended with UI-specific fields
type InternalPipelineConfig = Pipeline & {
  transformation?: {
    enabled?: boolean
    expression?: string
    fields?: any[]
  }
}
```

### Hydration Flow

```
1. API returns PipelineApiResponse
2. getPipelineAdapter(version) returns appropriate adapter
3. adapter.hydrate(apiResponse) → InternalPipelineConfig
4. enterViewMode(internalConfig) → populates stores
```

### Pipeline Adapter Interface

```typescript
interface PipelineAdapter {
  version: string
  hydrate(apiConfig: PipelineApiResponse): InternalPipelineConfig
  generate(internalConfig: InternalPipelineConfig): PipelineApiResponse
}
```

## State Management

### Store Hydration

**Hydrated Stores:**
- Kafka Store - Connection configuration
- Topics Store - Topic selection and event data
- Deduplication Store - Deduplication configuration
- Join Store - Join configuration
- Filter Store - Filter configuration
- Transformation Store - Transformation configuration
- ClickHouse Connection Store - Connection configuration
- ClickHouse Destination Store - Table mapping

**Hydration Cache:**
- Stored in sessionStorage as `lastHydratedPipeline`
- Key includes: pipeline ID, name, status, topics, version
- Prevents unnecessary re-hydration
- Cleared on resume to ensure fresh data

### Edit Mode

**View Mode:**
- Default mode when viewing pipeline
- Read-only access to configuration
- Can navigate and view all sections

**Edit Mode:**
- Enabled when user clicks "Edit" on a step
- Requires pipeline to be stopped
- Tracks unsaved changes (`isDirty`)
- Prevents hydration to avoid overwriting changes

## Pipeline Operations

| Operation | Confirmation | Status Transition | Notes |
|-----------|--------------|-------------------|-------|
| Stop | Yes | active → stopping → paused | Graceful stop |
| Resume | No | paused → resuming → active | Clears hydration cache |
| Edit | Yes (if active) | Stops pipeline first | Uses useSafeEnterEditMode |
| Rename | Yes | N/A | Optimistic update |
| Delete | Yes | N/A | Redirects to list |
| Terminate | Yes | * → terminating → terminated | Ungraceful |
| Download | Yes (if dirty) | N/A | Warning for unsaved changes |
| Flush DLQ | Yes | N/A | Clears dead letter queue |

## Testing

### Sidebar Tests

**Location:** `src/modules/pipelines/[id]/sidebar/sidebarItemBuilders.test.ts`

**Coverage:**
- Single-topic configurations
- Multi-topic configurations
- Deduplication scenarios
- Join scenarios
- Filter feature flag behavior
- Transformation detection
- Correct ordering of items

## Dependencies

### Internal Dependencies
- `@/src/store` - Global state management
- `@/src/hooks/usePipelineDetailsData` - Pipeline fetching
- `@/src/hooks/usePipelineHydration` - Pipeline hydration
- `@/src/hooks/usePipelineDisplayStatus` - Status display
- `@/src/hooks/useResumeWithPendingEdit` - Resume with edit flow
- `@/src/hooks/usePipelineActions` - Pipeline actions
- `@/src/hooks/usePipelineHealth` - Health monitoring
- `@/src/hooks/useStepDataPreloader` - Step data preloading
- `@/src/services/pipeline-state-manager` - Centralized state
- `@/src/api/pipeline-api` - API functions
- `@/src/modules/pipeline-adapters` - Version adapters
- `@/src/components/ui` - UI components (including DropdownMenu)

### External Dependencies
- `react` - React hooks and components
- `next/navigation` - Next.js navigation
- `next/image` - Next.js image optimization
- `@radix-ui/react-dropdown-menu` - Dropdown menu primitive

## Best Practices

1. **State Management:**
   - Use centralized hooks (usePipelineDetailsData, usePipelineHydration)
   - Use proper useStore selectors for reactivity
   - Never use `getState()` in render

2. **Adding New Steps:**
   - Add entry to `STEP_RENDERER_CONFIG` in `stepRendererConfig.ts`
   - Add props override in `stepProps.ts` if needed
   - Update sidebar builders if step should appear in sidebar

3. **Edit Mode:**
   - Always use `useSafeEnterEditMode` hook
   - Never call `enterEditMode` directly
   - Track unsaved changes via `isDirty`

4. **Navigation:**
   - Use `useActiveViewState` hook for view state
   - Update section, step, and topic index together
   - Always allow monitor section access

5. **Performance:**
   - Use configuration maps instead of if/else chains
   - Pre-load step data with `useStepDataPreloader`
   - Memoize expensive computations
