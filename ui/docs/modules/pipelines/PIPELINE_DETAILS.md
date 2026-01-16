# Pipeline Details Module Documentation

## Overview

The Pipeline Details module provides a comprehensive interface for viewing and managing a single pipeline's configuration, status, and metrics. It enables users to view pipeline details, navigate through configuration sections, edit pipeline settings, perform pipeline operations (stop, resume, terminate, delete, rename), and monitor pipeline health and performance.

## Architecture

### Component Hierarchy

```
PipelineDetailsModule (Main Container)
├── PipelineDetailsHeader
│   ├── Pipeline Name & Status
│   ├── Action Buttons (Stop, Resume, Edit, Rename, Delete, Download)
│   ├── Tags Display & Management
│   ├── Pipeline ID Copy
│   ├── Health Status Indicator
│   └── Context Menu (Additional Actions)
│
├── PipelineDetailsSidebar
│   ├── Monitor Section
│   ├── Kafka Connection
│   ├── Topic Selection (Single/Multi)
│   ├── Type Verification
│   ├── Deduplication
│   ├── Filter (if enabled)
│   ├── Transformation (if applicable, only in single topic journey)
│   ├── Join Configuration (if multi-topic)
│   ├── ClickHouse Connection
│   └── Destination Mapping
│
├── PipelineStatusOverviewSection
│   ├── DeadLetterQueueCard
│   └── ClickHouseTableMetricsCard
│
├── Configuration Overview (Monitor View)
│   ├── KafkaConnectionSection (Source)
│   ├── TransformationSection
│   │   ├── Topic Cards (Single/Multi)
│   │   ├── Deduplication Cards
│   │   ├── Join Cards (if enabled)
│   │   ├── Filter Card (if enabled)
│   │   ├── Transformation Card
│   │   └── Destination Card
│   └── ClickhouseConnectionSection (Sink)
│
└── StandaloneStepRenderer (When Step Active)
    ├── StepRendererPageComponent
    ├── Step Component (KafkaConnection, TopicSelector, etc.)
    ├── Edit Mode Toggle
    ├── Edit Confirmation Modal
    └── Pipeline Transition Overlay
```

## Core Components

### 1. PipelineDetailsModule

**Location:** `src/modules/pipelines/[id]/PipelineDetailsModule.tsx`

**Purpose:** The main container component that orchestrates the entire pipeline details view. It manages state, coordinates navigation, handles pipeline hydration, and provides the overall layout.

**Key Responsibilities:**
- Manages pipeline data state
- Handles pipeline hydration from API to store
- Coordinates sidebar navigation and step rendering
- Manages edit mode and read-only mode
- Handles pipeline operations via centralized actions
- Provides sequential animations for UI elements
- Manages tags modal
- Handles pipeline status updates

**Props:**
```typescript
{
  pipeline: Pipeline // Initial pipeline data from API
}
```

**Key State Management:**
- **Local Pipeline State:** Maintains a local copy of pipeline data for display
- **Active Step:** Tracks which configuration step is currently being viewed/edited
- **Active Section:** Tracks which sidebar section is highlighted
- **Active Topic Index:** For multi-topic pipelines, tracks which topic (0 = left, 1 = right)
- **Edit Mode:** Tracks whether pipeline is in edit mode
- **Animation States:** Controls sequential appearance of UI sections
- **Tags Modal:** Manages tags modal visibility and saving state

**Pipeline Hydration:**
The module handles hydration of pipeline data from API format to internal store format:

1. **Hydration Trigger:** Runs when:
   - Pipeline data is available
   - Pipeline has source and sink configured
   - Not in edit mode
   - No unsaved changes (`isDirty` is false)
   - Action is not loading

2. **Hydration Process:**
   - Creates cache key from pipeline ID, name, status, topics, and version
   - Checks sessionStorage for previous hydration
   - Verifies store actually has data (handles page reloads)
   - Gets appropriate pipeline adapter based on version
   - Converts API config to internal config via adapter
   - Calls `enterViewMode` to hydrate all stores
   - Caches hydration key in sessionStorage

3. **Hydration Cache:**
   - Prevents re-hydration on every render
   - Detects actual configuration changes (topics, version, etc.)
   - Cleared when pipeline is resumed (ensures fresh data)

**Sequential Animations:**
UI elements appear sequentially for better UX:
- Header: Immediate
- Status Overview: 500ms delay
- Configuration Section: 1000ms delay

**Action Completion Handling:**
When pipeline actions complete:
- Stop/Resume/Terminate: Reported to centralized system for status tracking
- Other actions: Refresh pipeline data after 500ms delay

### 2. PipelineDetailsHeader

**Location:** `src/modules/pipelines/[id]/PipelineDetailsHeader.tsx`

**Purpose:** Displays pipeline header with name, status, actions, tags, and health information.

**Key Features:**
- Pipeline name and status badge
- Action buttons (Stop, Resume, Edit, Rename, Delete, Download)
- Tags display and management
- Pipeline ID copy functionality
- Health status indicator
- Context menu for additional actions (Terminate, Flush DLQ)
- Unsaved changes warning for download

**Action Buttons:**
- **Stop:** Gracefully pause pipeline (shows confirmation modal)
- **Resume:** Resume paused pipeline (immediate action)
- **Edit:** Navigate to edit mode (disabled in demo mode)
- **Rename:** Change pipeline name (shows modal)
- **Delete:** Remove pipeline (shows confirmation modal)
- **Download:** Download pipeline configuration (shows warning if unsaved changes)

**Status Display:**
- Uses centralized pipeline status (`usePipelineState`)
- Falls back to pipeline prop status
- Shows health status from health monitoring
- Displays loading indicators during operations

**Health Monitoring:**
- Uses `usePipelineHealth` hook for health polling
- Disabled during transitional states (pausing, stopping, resuming)
- Polls every 5 seconds
- Stops on stable states (Running, Terminated, Failed)

**Context Menu:**
Additional actions available via menu button:
- Terminate (immediate stop)
- Flush DLQ (clear dead letter queue)
- Download (with unsaved changes warning)

**Unsaved Changes Handling:**
- Checks `coreStore.isDirty` before download
- Shows warning modal if unsaved changes exist
- Allows user to proceed or cancel

### 3. PipelineDetailsSidebar

**Location:** `src/modules/pipelines/[id]/PipelineDetailsSidebar.tsx`

**Purpose:** Provides navigation sidebar for pipeline configuration sections.

**Key Features:**
- Dynamic sidebar items based on pipeline configuration
- Highlights active section
- Clickable sections (disabled when editing is disabled)
- Supports single and multi-topic pipelines
- Handles topic indices for multi-topic deduplication

**Sidebar Sections:**
Generated dynamically based on pipeline config:

1. **Monitor:** Always available, shows status overview
2. **Kafka Connection:** Always available
3. **Topic Selection:**
   - Single topic: "Topic"
   - Multi-topic: "Left Topic" and "Right Topic"
   - Combined with deduplication if enabled
4. **Type Verification:**
   - Single topic: "Verify Field Types"
   - Multi-topic: "Left Topic Types" and "Right Topic Types"
5. **Deduplication:**
   - Single topic: "Deduplicate" (if enabled)
   - Multi-topic: Combined with topic selection
6. **Filter:** Only if filters feature is enabled
7. **Transformation:** Only if transformations are enabled and have fields
8. **Join Configuration:** Only for multi-topic pipelines with join enabled
9. **ClickHouse Connection:** Always available
10. **Destination:** Always available (ClickHouse Mapping)

**Dynamic Item Generation:**
The `getSidebarItems` function:
- Analyzes pipeline configuration
- Determines topic count (single vs multi)
- Checks for deduplication on each topic
- Checks for join configuration
- Checks for transformations
- Returns appropriate sidebar items with step keys and topic indices

**Section Click Handling:**
- Sets active section
- Sets active step (if section has step key)
- Sets topic index (for multi-topic sections)
- Prevents clicks when editing is disabled (except monitor)

### 4. PipelineStatusOverviewSection

**Location:** `src/modules/pipelines/[id]/PipelineStatusOverviewSection.tsx`

**Purpose:** Displays pipeline status overview cards with metrics.

**Key Features:**
- Dead Letter Queue (DLQ) metrics card
- ClickHouse table metrics card
- Sequential animation support
- Real-time metric updates

**Components:**
- **DeadLetterQueueCard:** Shows DLQ statistics (unconsumed messages, total messages)
- **ClickHouseTableMetricsCard:** Shows ClickHouse table metrics (rows, size, etc.)

### 5. TransformationSection

**Location:** `src/modules/pipelines/[id]/sections/TransformationSection.tsx`

**Purpose:** Displays visual representation of pipeline transformation configuration.

**Key Features:**
- Dynamic layout based on pipeline configuration
- Multiple layout cases:
  - Single topic (no join, no deduplication)
  - Single topic with deduplication
  - Multi-topic with join
  - Multi-topic with join and deduplication
- Clickable cards for navigation
- Validation state indicators
- Transformation type label

**Layout Cases:**

1. **Single Topic (No Deduplication):**
   - Topic card
   - Type verification card
   - Filter card (if enabled)
   - Transformation card (if enabled)
   - Destination card

2. **Single Topic with Deduplication:**
   - Topic card
   - Type verification card
   - Deduplication card
   - Filter card (if enabled)
   - Transformation card (if enabled)
   - Destination card

3. **Multi-Topic with Join:**
   - Left topic card
   - Right topic card
   - Left type verification card
   - Right type verification card
   - Join keys cards (left and right)
   - Transformation card (if enabled - not in this case)
   - Destination card

4. **Multi-Topic with Join and Deduplication:**
   - Left topic + deduplication card
   - Right topic + deduplication card
   - Left type verification card
   - Right type verification card
   - Join keys cards (left and right)
   - Transformation card (if enabled - not in this case)
   - Destination card

**Card Types:**
- **SingleCard:** Single column card
- **DoubleColumnCard:** Two columns (e.g., Destination Table and Schema Mapping)
- **SingleColumnCard:** Single column with orientation (left/right/center)
- **TitleCardWithIcon:** Icon-based card (for source/sink)

**Transformation Type Display:**
Shows transformation type label:
- "Ingest Only" (no transformations)
- "Deduplication" (deduplication only)
- "Join" (join enabled)
- "Join & Deduplication" (both enabled)

### 6. StandaloneStepRenderer

**Location:** `src/modules/pipelines/[id]/StandaloneStepRenderer.tsx`

**Purpose:** Renders individual configuration steps in standalone mode for viewing and editing.

**Key Features:**
- Renders step components in full-page mode
- Manages edit mode toggle
- Handles edit confirmation for active pipelines
- Pre-loads step data
- Shows loading states during operations
- Displays transition overlay during pipeline stopping

**Step Components:**
Supports all pipeline configuration steps:
- `KAFKA_CONNECTION`: KafkaConnectionContainer
- `TOPIC_SELECTION_1/2`: KafkaTopicSelector
- `TOPIC_DEDUPLICATION_CONFIGURATOR_1/2`: KafkaTopicSelector (with deduplication)
- `DEDUPLICATION_CONFIGURATOR`: DeduplicationConfigurator
- `KAFKA_TYPE_VERIFICATION`: KafkaTypeVerification
- `FILTER_CONFIGURATOR`: FilterConfigurator
- `TRANSFORMATION_CONFIGURATOR`: TransformationConfigurator
- `JOIN_CONFIGURATOR`: JoinConfigurator
- `CLICKHOUSE_CONNECTION`: ClickhouseConnectionContainer
- `CLICKHOUSE_MAPPER`: ClickhouseMapper

**Edit Mode Management:**
- Starts in read-only mode
- User must click "Edit" to enable editing
- For stopped/terminated pipelines: Edit enabled immediately
- For active/paused pipelines: Shows confirmation modal, stops pipeline, then enables edit
- Prevents editing during transitional states

**Edit Confirmation Flow:**
1. User clicks "Edit" on active pipeline
2. Edit confirmation modal shown
3. User confirms
4. Pipeline stopped via centralized actions
5. Transition overlay shown
6. Edit mode enabled when status changes to 'stopped'

**Data Preloading:**
- Uses `useStepDataPreloader` hook
- Pre-loads required data for step
- Shows loading indicator during preload
- Shows error state if preload fails
- Retry functionality for failed preloads

**Props Passed to Step Components:**
- `steps`: Step configuration
- `onCompleteStep`: Step completion handler
- `validate`: Validation function
- `standalone`: Always `true`
- `onCompleteStandaloneEditing`: Close handler
- `readOnly`: Based on edit mode
- `toggleEditMode`: Edit mode toggle handler
- `pipelineActionState`: Loading state for operations
- `pipeline`: Pipeline data
- `currentStep`: For topic selector steps
- `enableDeduplication`: For topic+dedup steps
- `index`: Topic index for multi-topic steps

### 7. KafkaConnectionSection

**Location:** `src/modules/pipelines/[id]/sections/KafkaConnectionSection.tsx`

**Purpose:** Displays source (Kafka) connection section in configuration overview.

**Key Features:**
- Shows "Source" label
- Kafka icon card
- Clickable to navigate to Kafka connection step
- Validation state indicator
- Selection highlight when active

### 8. ClickhouseConnectionSection

**Location:** `src/modules/pipelines/[id]/sections/ClickhouseConnectionSection.tsx`

**Purpose:** Displays sink (ClickHouse) connection section in configuration overview.

**Key Features:**
- Shows "Sink" label
- ClickHouse icon card
- Clickable to navigate to ClickHouse connection step
- Validation state indicator
- Selection highlight when active

## State Management

### Pipeline State

**Local State:**
- Maintains local copy of pipeline data
- Updated when pipeline is refreshed or modified
- Used for display and status checks

**Centralized State:**
- Uses `usePipelineState` for status
- Uses `usePipelineOperations` for operations
- Uses `usePipelineMonitoring` for status polling
- Status updates propagate automatically

### Store Hydration

**Hydration Process:**
1. Pipeline adapter converts API config to internal format
2. `enterViewMode` sets core store to view mode
3. `hydrateFromConfig` hydrates all stores:
   - Kafka store
   - Topics store
   - Deduplication store
   - Join store
   - Filter store
   - Transformation store
   - ClickHouse connection store
   - ClickHouse destination store

**Hydration Cache:**
- Stored in sessionStorage as `lastHydratedPipeline`
- Key includes: pipeline ID, name, status, topics, version
- Prevents unnecessary re-hydration
- Cleared on resume to ensure fresh data

**Hydration Guards:**
- Skips if `isDirty` (unsaved changes)
- Skips if in edit mode
- Skips if action is loading
- Verifies store has data (handles page reloads)

### Edit Mode

**View Mode:**
- Default mode when viewing pipeline
- Read-only access to configuration
- Can navigate and view all sections
- Can perform operations (stop, resume, etc.)

**Edit Mode:**
- Enabled when user clicks "Edit" on a step
- Requires pipeline to be stopped
- Allows modification of configuration
- Tracks unsaved changes (`isDirty`)
- Prevents hydration to avoid overwriting changes

**Mode Transitions:**
- View → Edit: User clicks "Edit", pipeline stopped if needed
- Edit → View: User saves or cancels changes

## Pipeline Operations

### Stop (Pause)

**Flow:**
1. User clicks "Stop" button
2. Confirmation modal shown
3. User confirms
4. Operation reported to centralized system
5. API call: `stopPipeline(pipelineId)` (graceful)
6. Status updates via centralized tracking
7. Pipeline data refreshed

**Characteristics:**
- Graceful stop (processes remaining messages)
- Requires confirmation
- Status: `active` → `stopping` → `paused`

### Resume

**Flow:**
1. User clicks "Resume" button
2. Operation reported to centralized system
3. API call: `resumePipeline(pipelineId)`
4. Status updates via centralized tracking
5. Hydration cache cleared (ensures fresh data)

**Characteristics:**
- Immediate action (no confirmation)
- Status: `paused` → `resuming` → `active`
- Clears hydration cache

### Edit

**Flow:**
1. User clicks "Edit" button or "Edit" on a step
2. If pipeline is active: Confirmation modal shown
3. If confirmed: Pipeline stopped
4. Edit mode enabled
5. User can modify configuration
6. Changes saved to store
7. `isDirty` flag set

**Characteristics:**
- Requires pipeline to be stopped
- Automatically stops active pipelines
- Enables edit mode for specific step
- Tracks unsaved changes

### Rename

**Flow:**
1. User clicks "Rename" button
2. Rename modal shown with current name
3. User enters new name and confirms
4. Operation reported to centralized system
5. API call: `renamePipeline(pipelineId, newName)`
6. Local pipeline state updated
7. Optimistic update in UI

**Characteristics:**
- Immediate optimistic update
- No refresh needed
- Reverts on error

### Delete

**Flow:**
1. User clicks "Delete" button
2. Confirmation modal shown
3. User confirms
4. Operation reported to centralized system
5. API call: `deletePipeline(pipelineId)`
6. Redirects to pipelines list

**Characteristics:**
- Requires confirmation
- Permanent action
- Redirects after deletion

### Terminate

**Flow:**
1. User clicks "Terminate" in context menu
2. Confirmation modal shown
3. User confirms
4. Operation reported to centralized system
5. API call: `terminatePipeline(pipelineId)` (ungraceful)
6. Status updates via centralized tracking

**Characteristics:**
- Immediate termination (ungraceful)
- Requires confirmation
- Status: `*` → `terminating` → `terminated`

### Download

**Flow:**
1. User clicks "Download" button
2. If unsaved changes: Warning modal shown
3. User confirms or cancels
4. Pipeline configuration downloaded as JSON

**Characteristics:**
- Downloads current configuration
- Warns if unsaved changes exist
- Downloads from store (includes unsaved changes if in edit mode)

### Flush DLQ

**Flow:**
1. User clicks "Flush DLQ" in context menu
2. Confirmation modal shown
3. User confirms
4. API call: `purgePipelineDLQ(pipelineId)`
5. Success notification shown

**Characteristics:**
- Clears dead letter queue
- Requires confirmation
- Permanent action

## Navigation Flow

### Section Navigation

**Sidebar Click:**
1. User clicks sidebar section
2. `handleSectionClick` called
3. Active section set
4. Active step set (if section has step key)
5. Topic index set (for multi-topic sections)
6. StandaloneStepRenderer renders step component

**Step Card Click:**
1. User clicks configuration card
2. `handleStepClick` called with step key
3. Active step set
4. Active section updated to match
5. StandaloneStepRenderer renders step component

**Close Step:**
1. User clicks close/back
2. `handleCloseStep` called
3. Active step cleared
4. Active section set to 'monitor'
5. Returns to status overview

### Edit Mode Navigation

**Entering Edit Mode:**
1. User clicks "Edit" on a step
2. If pipeline active: Confirmation shown
3. Pipeline stopped if needed
4. Edit mode enabled
5. Step component receives `readOnly: false`

**Exiting Edit Mode:**
1. User saves changes or cancels
2. Edit mode disabled
3. Returns to view mode
4. Pipeline data refreshed if saved

## Pipeline Hydration

### Adapter Pattern

**Purpose:**
Converts between API format and internal UI format, supporting multiple pipeline versions.

**Pipeline Adapters:**
- **V1 Adapter:** Handles V1 pipeline format
- **V2 Adapter:** Handles V2 pipeline format (with root-level schema)

**Adapter Interface:**
```typescript
interface PipelineAdapter {
  version: string
  hydrate(apiConfig: any): InternalPipelineConfig
  generate(internalConfig: InternalPipelineConfig): any
}
```

**Hydration Process:**
1. Get adapter based on pipeline version
2. Call `adapter.hydrate(apiConfig)` to convert to internal format
3. Pass internal config to `enterViewMode`
4. Stores hydrate from internal config

**V2 Specific Handling:**
- Converts `stateless_transformation` to `transformation` format
- Handles root-level schema
- Maintains backward compatibility

### Store Hydration

**Hydrated Stores:**
- **Kafka Store:** Connection configuration
- **Topics Store:** Topic selection and event data
- **Deduplication Store:** Deduplication configuration
- **Join Store:** Join configuration
- **Filter Store:** Filter configuration
- **Transformation Store:** Transformation configuration
- **ClickHouse Connection Store:** Connection configuration
- **ClickHouse Destination Store:** Table mapping

**Hydration Functions:**
Each store has a hydration function that:
- Extracts relevant data from pipeline config
- Converts API format to store format
- Sets store state
- Handles missing or invalid data

## Status Polling

### Health Monitoring

**Purpose:**
Monitor pipeline health and status in real-time.

**Implementation:**
- Uses `usePipelineHealth` hook
- Polls health endpoint every 5 seconds
- Disabled during transitional states
- Stops on stable states

**Health Data:**
- Overall status (Running, Paused, Terminated, Failed)
- Component health
- Error information

### Centralized Status Tracking

**Purpose:**
Track pipeline status changes across the application.

**Implementation:**
- Uses `usePipelineState` hook
- Subscribes to centralized state manager
- Updates automatically when status changes
- Handles optimistic updates

**Status Updates:**
- Operations report to centralized system
- System tracks status transitions
- Components subscribe to updates
- UI updates automatically

## Error Handling

### API Errors

**Centralized Error Handler:**
- Uses `handleApiError` utility
- Shows user-friendly notifications
- Provides retry functionality
- Tracks error analytics

**Operation Errors:**
- Optimistic updates reverted on error
- Error state shown in UI
- User can retry operation
- Error notifications displayed

### Hydration Errors

**Error Handling:**
- Errors logged to console
- Store validation states handle errors
- UI shows error states
- User can retry hydration

### Edit Mode Errors

**Validation Errors:**
- Shown inline in form fields
- Prevent saving invalid configuration
- Clear error messages

**Save Errors:**
- Error notification shown
- Changes remain in store
- User can fix and retry

## UI/UX Features

### Sequential Animations

**Purpose:**
Improve perceived performance and guide user attention.

**Animation Sequence:**
1. Header: Immediate
2. Status Overview: 500ms delay
3. Configuration Section: 1000ms delay

**Implementation:**
- Uses CSS transitions
- Opacity and translate transforms
- Smooth easing functions

### Loading States

**Operation Loading:**
- Loading indicators during operations
- Disabled buttons during operations
- Loading text for context

**Data Loading:**
- Preloader for step data
- Progress indicators
- Error states with retry

### Transition Overlays

**Purpose:**
Show progress during pipeline state transitions.

**Implementation:**
- Shown during pipeline stopping for edit
- Displays transition message
- Prevents user interaction
- Auto-dismisses when complete

### Validation Indicators

**Purpose:**
Show configuration validation state.

**Implementation:**
- Color-coded validation states
- Error indicators on invalid sections
- Success indicators on valid sections
- Warning indicators on incomplete sections

## Dependencies

### Internal Dependencies
- `@/src/store` - Global state management
- `@/src/hooks/usePipelineState` - Pipeline state hooks
- `@/src/hooks/usePipelineActions` - Pipeline actions hook
- `@/src/hooks/usePipelineHealth` - Health monitoring hook
- `@/src/hooks/useStepDataPreloader` - Step data preloading
- `@/src/services/pipeline-state-manager` - Centralized state management
- `@/src/api/pipeline-api` - Pipeline API functions
- `@/src/modules/pipeline-adapters` - Pipeline version adapters
- `@/src/components/ui` - UI components
- `@/src/components/common` - Common components
- `@/src/modules` - Pipeline configuration modules

### External Dependencies
- `react` - React hooks and components
- `next/navigation` - Next.js navigation
- `next/image` - Next.js image optimization

## Best Practices

1. **State Management:**
   - Always use centralized state hooks
   - Report operations via `usePipelineOperations`
   - Start monitoring with `usePipelineMonitoring`
   - Never directly mutate pipeline status

2. **Hydration:**
   - Check for unsaved changes before hydrating
   - Use hydration cache to prevent loops
   - Clear cache when pipeline is resumed
   - Verify store has data after page reload

3. **Edit Mode:**
   - Always start in read-only mode
   - Require explicit "Edit" click
   - Stop pipeline before editing if needed
   - Track unsaved changes

4. **Error Handling:**
   - Use centralized error handler
   - Revert optimistic updates on error
   - Show user-friendly error messages
   - Provide retry functionality

5. **Navigation:**
   - Update both active section and active step
   - Handle topic indices for multi-topic pipelines
   - Prevent navigation when editing disabled
   - Always allow monitor section access

6. **Performance:**
   - Use memoization for expensive computations
   - Pre-load step data
   - Lazy load step components
   - Debounce rapid state changes

## Future Improvements

1. **Enhanced Metrics:**
   - Real-time metrics dashboard
   - Historical metrics charts
   - Performance analytics

2. **Advanced Editing:**
   - Multi-step editing
   - Undo/redo functionality
   - Change history

3. **Better Navigation:**
   - Breadcrumb navigation
   - Keyboard shortcuts
   - Quick navigation menu

4. **Status Polling:**
   - WebSocket support for real-time updates
   - Configurable polling intervals
   - Smart polling (only poll active pipelines)

5. **UI Enhancements:**
   - Dark mode support
   - Responsive design improvements
   - Accessibility enhancements
