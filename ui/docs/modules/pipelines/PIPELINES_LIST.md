# Pipelines List Module Documentation

## Overview

The Pipelines List module is responsible for displaying and managing a list of all pipelines in the application. It provides a comprehensive interface for viewing pipeline information, performing operations (stop, resume, edit, rename, terminate, delete), filtering pipelines by status, health, and tags, and monitoring pipeline status through real-time polling.

## Architecture

### Component Hierarchy

```
PipelinesList (Main Component)
├── Header Section
│   ├── Title
│   ├── Filter Button (with indicator)
│   ├── Filter Chips (Status, Health, Tags)
│   └── New Pipeline Button
│
├── PipelineFilterMenu (Filter Configuration)
│   ├── Status Filters (active, paused, stopped, failed)
│   ├── Health Filters (stable, unstable)
│   └── Tag Filters (dynamic from available tags)
│
├── PipelinesTable (Desktop/Tablet View)
│   ├── Sortable Columns
│   │   ├── Name (with loading indicator)
│   │   ├── Transformation
│   │   ├── Tags
│   │   ├── Health
│   │   ├── Events in DLQ
│   │   ├── Status
│   │   ├── Created
│   │   └── Actions (Context Menu)
│   └── Row Click Navigation
│
├── MobilePipelinesList (Mobile View)
│   ├── Pipeline Cards
│   │   ├── Name & Actions
│   │   ├── Transformation
│   │   ├── Status Badge
│   │   ├── Tags
│   │   ├── DLQ Stats
│   │   ├── Health Status
│   │   └── Created Date
│   └── Row Click Navigation
│
├── TableContextMenu (Action Menu)
│   ├── Stop (graceful pause)
│   ├── Resume
│   ├── Edit
│   ├── Rename
│   ├── Terminate (ungraceful stop)
│   ├── Delete
│   ├── Download Configuration
│   └── Manage Tags
│
└── Modals
    ├── StopPipelineModal
    ├── ResumePipelineModal (immediate action)
    ├── EditPipelineModal
    ├── RenamePipelineModal
    ├── TerminatePipelineModal
    ├── PipelineTagsModal
    └── InfoModal (Pipeline Limit)
```

## Core Components

### 1. PipelinesList

**Location:** `src/modules/pipelines/PipelinesList.tsx`

**Purpose:** The main container component that orchestrates the entire pipelines list functionality. It manages state, handles pipeline operations, coordinates filtering, and provides responsive rendering.

**Key Responsibilities:**

- Manages pipeline list state and operations
- Handles filtering by status, health, and tags
- Coordinates pipeline operations (stop, resume, edit, rename, terminate, delete)
- Manages pipeline status polling through centralized state management
- Provides responsive rendering (desktop table vs mobile cards)
- Handles URL-based filter persistence
- Tracks analytics events for all operations
- Manages loading states for individual pipeline operations

**Props:**

```typescript
{
  pipelines: ListPipelineConfig[]
  onRefresh?: () => Promise<void>
  onUpdatePipelineStatus?: (pipelineId: string, status: PipelineStatus) => void
  onUpdatePipelineName?: (pipelineId: string, newName: string) => void
  onRemovePipeline?: (pipelineId: string) => void
  onUpdatePipelineTags?: (pipelineId: string, tags: string[]) => void
}
```

**Key State Management:**

- Uses `useMultiplePipelineState` hook to get centralized pipeline statuses
- Uses `usePipelineOperations` hook to report operations to central system
- Uses `usePipelineMonitoring` hook to start/stop monitoring pipelines
- Maintains local state for:
  - Filter state (status, health, tags)
  - Modal visibility states
  - Individual pipeline operation loading states
  - Tags modal state

**Filter State Management:**
Filters are synchronized with URL search parameters:

- Status filters: `?status=active,paused`
- Health filters: `?health=stable,unstable`
- Tag filters: `?tags=tag1,tag2`
- Filters are parsed from URL on mount and updated when changed
- URL is updated when filters change (using `router.replace` with `scroll: false`)

### 2. PipelinesTable

**Location:** `src/modules/pipelines/PipelinesTable.tsx`

**Purpose:** Renders pipelines in a sortable table format for desktop and tablet views.

**Key Features:**

- Sortable columns with visual indicators (ascending/descending)
- Custom sorting logic for status column (uses priority order)
- Supports nested property sorting (e.g., `dlq_stats.unconsumed_messages`)
- Handles null/undefined values in sorting
- Clickable rows for navigation
- Empty state message
- Loading state display

**Column Configuration:**
Each column is defined with:

- `key`: Unique identifier
- `header`: Display name
- `width`: CSS grid width (e.g., '2fr', '1fr')
- `align`: Text alignment ('left', 'center', 'right')
- `sortable`: Whether column can be sorted
- `sortKey`: Optional key for sorting (defaults to `key`)
- `render`: Custom render function for cell content

**Status Priority Order:**

```typescript
{
  active: 1,
  resuming: 2,
  pausing: 3,
  paused: 4,
  stopping: 5,
  stopped: 6,
  failed: 7
}
```

**Sorting Behavior:**

- Clicking a sortable column cycles through: `asc` → `desc` → `null` (no sort)
- Status column uses priority-based sorting
- Date columns use timestamp comparison
- String columns use locale-aware comparison
- Null values are sorted to the end

### 3. MobilePipelinesList

**Location:** `src/modules/pipelines/MobilePipelinesList.tsx`

**Purpose:** Renders pipelines as cards for mobile devices.

**Key Features:**

- Card-based layout optimized for mobile screens
- Displays key pipeline information in compact format
- Shows loading indicators for operations
- Includes context menu for actions
- Clickable cards for navigation
- Empty state message

**Card Information Display:**
Each card shows:

- Pipeline name with loading indicator
- Transformation type
- Status badge
- Tags (up to 3 visible, with "+N more" indicator)
- Events in DLQ count
- Health status (stable/unstable)
- Created date

### 4. TableContextMenu

**Location:** `src/modules/pipelines/TableContextMenu.tsx`

**Purpose:** Provides a dropdown menu with pipeline actions based on current pipeline status.

**Key Features:**

- Context-aware action visibility (actions shown based on pipeline status)
- Loading state handling (disables actions during operations)
- Demo mode support (disables certain actions)
- Action availability determined by centralized `shouldShowAction` utility
- Visual feedback for destructive actions (terminate, delete)

**Available Actions:**

- **Stop:** Gracefully pause pipeline (available when active)
- **Resume:** Resume paused pipeline (available when paused/stopped)
- **Edit:** Navigate to edit pipeline (available when stopped/paused)
- **Rename:** Change pipeline name (available for all statuses)
- **Terminate:** Immediately stop pipeline (available for most statuses)
- **Delete:** Remove pipeline (available when terminated/stopped)
- **Download:** Download pipeline configuration (always available)
- **Manage Tags:** Edit pipeline tags (disabled in demo mode)

**Action Visibility Logic:**
Actions are shown/hidden based on:

- Pipeline status (e.g., Resume only shown when paused)
- Demo mode (tags management disabled)
- Centralized `shouldShowAction` utility function

### 5. PipelineFilterMenu

**Location:** `src/modules/pipelines/PipelineFilterMenu.tsx`

**Purpose:** Provides a dropdown menu for configuring pipeline filters.

**Key Features:**

- Multi-select checkboxes for status filters
- Multi-select checkboxes for health filters
- Tag selection buttons (pill-style)
- Positioned relative to filter button
- Closes on outside click
- Visual indicators for selected filters

**Filter Options:**

- **Status:** active, paused, stopped, failed
- **Health:** stable, unstable
- **Tags:** Dynamic list from all available pipeline tags

## State Management

### Centralized Pipeline State

The module uses a centralized pipeline state management system:

**PipelineStateManager** (`src/services/pipeline-state-manager.ts`):

- Single source of truth for pipeline statuses
- Subscribes to status changes via callbacks
- Manages optimistic updates for operations
- Coordinates with PipelineStatusManager for polling

**PipelineStatusManager** (`src/services/pipeline-status-manager.ts`):

- Handles actual status polling from backend
- Uses progressive polling intervals (starts fast, slows down)
- Supports multiple pipelines with individual lifecycle management
- Handles error retries and backoff
- Stops polling when pipelines reach final states

### Hooks

#### useMultiplePipelineState

**Location:** `src/hooks/usePipelineState.ts`

**Purpose:** Gets status for multiple pipelines from centralized state.

**Usage:**

```typescript
const pipelineStatuses = useMultiplePipelineState(pipelineIds)
// Returns: Record<string, PipelineStatus | null>
```

**Behavior:**

- Subscribes to status changes for all provided pipeline IDs
- Returns current statuses as a map
- Automatically updates when statuses change
- Unsubscribes on unmount

#### usePipelineOperations

**Location:** `src/hooks/usePipelineState.ts`

**Purpose:** Provides interface to report pipeline operations to central system.

**Methods:**

- `reportStop(pipelineId)`: Reports stop operation, sets optimistic status to 'stopping'
- `reportResume(pipelineId)`: Reports resume operation, sets optimistic status to 'resuming'
- `reportTerminate(pipelineId)`: Reports terminate operation, sets optimistic status to 'terminating'
- `reportDelete(pipelineId)`: Reports delete operation, sets optimistic status to 'stopped'
- `revertOptimisticUpdate(pipelineId, originalStatus)`: Reverts optimistic update on error

#### usePipelineMonitoring

**Location:** `src/hooks/usePipelineState.ts`

**Purpose:** Manages pipeline monitoring lifecycle.

**Usage:**

```typescript
usePipelineMonitoring(pipelineIds)
```

**Behavior:**

- Starts monitoring all provided pipeline IDs on mount
- Stops monitoring when component unmounts
- Automatically handles cleanup

### Local State

The component maintains local state for:

- **Filter state:** Current active filters (status, health, tags)
- **Modal visibility:** Which modals are currently open
- **Pipeline operations:** Loading state for each pipeline operation
- **Tags modal:** Selected pipeline and saving state

## Pipeline Operations

### Stop (Pause)

**Flow:**

1. User clicks "Stop" in context menu
2. `StopPipelineModal` is shown
3. User confirms stop operation
4. Modal closes immediately
5. Loading state is set for the pipeline
6. Operation is reported to central system (`operations.reportStop`)
7. API call: `stopPipeline(pipelineId)` (graceful stop)
8. Central system handles status tracking
9. Analytics events tracked (pauseClicked, pauseSuccess/pauseFailed)
10. Loading state cleared

**Characteristics:**

- Graceful stop (processes remaining messages)
- Can take time to complete
- Status transitions: `active` → `stopping` → `paused`
- Optimistic update: Sets status to `stopping` immediately

### Resume

**Flow:**

1. User clicks "Resume" in context menu
2. Loading state is set immediately
3. Operation is reported to central system (`operations.reportResume`)
4. API call: `resumePipeline(pipelineId)`
5. Session storage cache cleared (ensures fresh data on navigation)
6. Central system handles status tracking
7. Analytics events tracked
8. Loading state cleared

**Characteristics:**

- Immediate action (no confirmation modal)
- Status transitions: `paused` → `resuming` → `active`
- Optimistic update: Sets status to `resuming` immediately
- Clears hydration cache to ensure fresh data

### Edit

**Flow:**

1. User clicks "Edit" in context menu
2. If pipeline is active, it must be stopped first
3. Loading state is set
4. If active: Stop pipeline first (`stopPipeline`)
5. Status updated to `stopping` then `stopped`
6. Navigate to pipeline details page (`/pipelines/${pipelineId}`)
7. Analytics events tracked
8. Loading state cleared

**Characteristics:**

- Requires pipeline to be stopped before editing
- Automatically stops active pipelines
- Navigates to edit page after stopping
- Status transitions: `active` → `stopping` → `stopped` → navigate

### Rename

**Flow:**

1. User clicks "Rename" in context menu
2. `RenamePipelineModal` is shown with current name
3. User enters new name and confirms
4. Modal closes immediately
5. Loading state is set
6. Optimistic update: Name updated in UI immediately
7. API call: `renamePipeline(pipelineId, newName)`
8. Analytics events tracked
9. On error: Revert optimistic update
10. Loading state cleared

**Characteristics:**

- Immediate optimistic update
- No refresh needed
- Reverts on error
- Status-independent (can rename any pipeline)

### Terminate

**Flow:**

1. User clicks "Terminate" in context menu
2. `TerminatePipelineModal` is shown (confirmation required)
3. User confirms termination
4. Modal closes immediately
5. Loading state is set
6. Operation is reported to central system (`operations.reportTerminate`)
7. API call: `terminatePipeline(pipelineId)` (ungraceful stop)
8. Central system handles status tracking
9. Analytics events tracked
10. Loading state cleared

**Characteristics:**

- Ungraceful stop (immediate termination)
- Requires confirmation
- Status transitions: `*` → `terminating` → `terminated`
- Optimistic update: Sets status to `terminating` immediately

### Delete

**Flow:**

1. User clicks "Delete" in context menu
2. Loading state is set immediately
3. Operation is reported to central system (`operations.reportDelete`)
4. API call: `deletePipeline(pipelineId)`
5. Pipeline removed from list (`onRemovePipeline`)
6. Refresh triggered after 1 second
7. Analytics events tracked
8. Loading state cleared

**Characteristics:**

- Immediate action (no confirmation modal in context menu)
- Removes pipeline from list optimistically
- Triggers refresh to ensure backend sync
- Status-independent (can delete any pipeline)

### Manage Tags

**Flow:**

1. User clicks "Manage Tags" in context menu
2. `PipelineTagsModal` is shown with current tags
3. User adds/removes tags
4. User saves changes
5. Loading state is set
6. API call: `updatePipelineMetadata(pipelineId, { tags: newTags })`
7. Success notification shown
8. Modal closes
9. Pipeline tags updated in list
10. Loading state cleared

**Characteristics:**

- Tag management interface
- Disabled in demo mode
- Updates pipeline metadata
- Immediate UI update on success

## Status Polling

### Polling Architecture

The module uses a centralized polling system managed by `PipelineStatusManager`:

**Initialization:**

```typescript
// Get pipeline IDs from list
const pipelineIds = useMemo(() => pipelines.map((p) => p.pipeline_id), [pipelines])

// Start monitoring all pipelines
usePipelineMonitoring(pipelineIds)
```

**Polling Behavior:**

- Polls health endpoint (`/pipeline/{id}/health`) for each pipeline
- Progressive intervals:
  - First 2 minutes: Every 2 seconds
  - 2-5 minutes: Every 5 seconds
  - 5-10 minutes: Every 10 seconds
  - After 10 minutes: Every 30 seconds
- Stops polling when pipeline reaches final state (stopped, terminated, failed)
- Handles errors with exponential backoff
- Stops after 5 consecutive errors

**Status Updates:**

- Status changes trigger callbacks
- Centralized state manager updates global state
- Components subscribe to state changes via `useMultiplePipelineState`
- UI automatically updates when status changes

**Backend Synchronization:**

- Periodic backend sync (every 30 seconds) to detect externally modified pipelines
- Compares local state with backend state
- Updates local state if discrepancies found

### Status Display

**Effective Status:**
The component uses `getEffectiveStatus` to determine displayed status:

1. First checks centralized state (`pipelineStatuses[pipelineId]`)
2. Falls back to pipeline data status
3. Defaults to 'active' if no status available

**Status Badges:**

- **Active:** Green badge
- **Pausing/Resuming/Stopping:** Yellow badge (warning)
- **Paused:** Yellow badge (warning)
- **Stopped/Terminated:** Gray badge (secondary)
- **Failed:** Red badge (error)

**Status Labels:**

- `active` → "Active"
- `pausing` → "Pausing..."
- `paused` → "Paused"
- `resuming` → "Resuming..."
- `stopping` → "Stopping..."
- `stopped` → "Stopped"
- `terminating` → "Terminating..."
- `terminated` → "Terminated"
- `failed` → "Failed"

## Filtering

### Filter Types

**Status Filters:**

- Filter by pipeline status: active, paused, stopped, failed
- Multiple statuses can be selected
- Filters pipelines using effective status (from centralized state)

**Health Filters:**

- Filter by health status: stable, unstable
- Health determined by DLQ stats (unconsumed messages > 0 = unstable)
- Multiple health statuses can be selected

**Tag Filters:**

- Filter by pipeline tags
- Multiple tags can be selected
- Only pipelines with ALL selected tags are shown
- Available tags extracted from all pipelines

### Filter State Management

**URL Synchronization:**

- Filters are stored in URL search parameters
- Format: `?status=active,paused&health=stable&tags=tag1,tag2`
- Filters parsed from URL on component mount
- URL updated when filters change (using `router.replace` with `scroll: false`)
- Prevents page scroll on filter changes

**Filter Parsing:**

```typescript
// Parse from URL
parseFiltersFromParams(searchParams)
// Returns: { status: PipelineStatus[], health: ('stable'|'unstable')[], tags: string[] }

// Serialize to URL
serializeFilters(filters)
// Returns: URLSearchParams string
```

**Filter Application:**
Filters are applied in `filteredPipelines` memo:

1. Status filter: Checks effective status against filter
2. Health filter: Checks `health_status` property
3. Tag filter: Checks if pipeline has all selected tags (case-insensitive)

### Filter UI

**Filter Button:**

- Shows indicator dot when filters are active
- Opens/closes filter menu
- Positioned next to page title

**Filter Chips:**

- Display active filters as removable chips
- Show filter type (Status, Health, Tags) and values
- Click chip to open filter menu
- Click X to clear that filter type

**Filter Menu:**

- Dropdown menu positioned below filter button
- Checkboxes for status and health filters
- Pill buttons for tag selection
- Closes on outside click

## Responsive Design

### Desktop/Tablet View

**Breakpoint:** `md` (768px and above)

**Layout:**

- Full table with all columns
- Sortable columns
- Context menu in Actions column
- Row click navigation

**Columns:**

- Name (2fr)
- Transformation (2fr)
- Tags (2fr)
- Health (1fr)
- Events in DLQ (1fr)
- Status (1fr)
- Created (1.5fr)
- Actions (1fr)

### Mobile View

**Breakpoint:** Below `md` (below 768px)

**Layout:**

- Card-based layout
- Each pipeline as a card
- Key information displayed
- Context menu in card header
- Card click navigation

**Card Information:**

- Pipeline name with loading indicator
- Transformation type
- Status badge
- Tags (up to 3 visible)
- DLQ stats
- Health status
- Created date

## API Integration

### Pipeline List API

**Endpoint:** `GET /ui-api/pipeline`

**Response:**

```typescript
{
  success: boolean
  pipelines: ListPipelineConfig[]
}
```

**Pipeline Data Enhancement:**
After fetching list, the component:

1. Fetches full pipeline config for each pipeline (to determine transformation type)
2. Fetches DLQ stats for all pipelines in parallel
3. Determines health status based on DLQ stats
4. Merges all data into enhanced pipeline objects

### Pipeline Operations API

**Stop:** `POST /ui-api/pipeline/{id}/stop`

- Graceful stop (processes remaining messages)

**Resume:** `POST /ui-api/pipeline/{id}/resume`

- Resume paused pipeline

**Terminate:** `POST /ui-api/pipeline/{id}/terminate`

- Immediate termination (ungraceful)

**Delete:** `DELETE /ui-api/pipeline/{id}`

- Remove pipeline

**Rename:** `PUT /ui-api/pipeline/{id}/rename`

- Update pipeline name

**Update Metadata:** `PUT /ui-api/pipeline/{id}/metadata`

- Update pipeline metadata (tags, etc.)

### Health API

**Endpoint:** `GET /ui-api/pipeline/{id}/health`

**Response:**

```typescript
{
  overall_status: string // 'Running', 'Paused', etc.
  // ... other health data
}
```

**Usage:**

- Used by PipelineStatusManager for status polling
- Parsed to UI status format via `parsePipelineStatus`

## Error Handling

### API Error Handling

**Centralized Error Handler:**
Uses `handleApiError` utility for consistent error handling:

- Shows user-friendly error notifications
- Provides retry functionality where appropriate
- Tracks error analytics
- Handles specific error cases (e.g., "must be stopped" for edit)

**Error Notifications:**

- Toast notifications for immediate feedback
- Includes error message and retry option
- Links to issue tracker for persistent errors

### Operation Error Handling

**Optimistic Updates:**

- Operations apply optimistic updates immediately
- On error, optimistic updates are reverted
- Uses `operations.revertOptimisticUpdate` to restore previous status

**Loading States:**

- Individual pipeline loading states prevent duplicate operations
- Loading indicators shown during operations
- Operations disabled while loading

**Retry Logic:**

- Some operations provide retry functions
- Retry functions included in error notifications
- User can retry failed operations

## Analytics Integration

The module tracks analytics events for all operations:

**Page View:**

- `analytics.page.pipelines({})` - When pipelines list page loads

**Pipeline Operations:**

- `analytics.pipeline.pauseClicked` / `pauseSuccess` / `pauseFailed`
- `analytics.pipeline.resumeClicked` / `resumeSuccess` / `resumeFailed`
- `analytics.pipeline.editClicked` / `editSuccess` / `editFailed`
- `analytics.pipeline.renameClicked` / `renameSuccess` / `renameFailed`
- `analytics.pipeline.deleteClicked` / `deleteSuccess` / `deleteFailed`

**Event Data:**

- Pipeline ID
- Pipeline name
- Current status
- Operation-specific data (e.g., new name for rename)
- Error messages (for failures)

## Dependencies

### Internal Dependencies

- `@/src/store` - Global state management
- `@/src/hooks/usePipelineState` - Pipeline state hooks
- `@/src/services/pipeline-state-manager` - Centralized state management
- `@/src/services/pipeline-status-manager` - Status polling
- `@/src/api/pipeline-api` - Pipeline API functions
- `@/src/components/ui` - UI components (Badge, Button)
- `@/src/components/common` - Common components (Modals)
- `@/src/notifications` - Notification system
- `@/src/utils` - Utility functions

### External Dependencies

- `react` - React hooks and components
- `next/navigation` - Next.js navigation (useRouter, useSearchParams)
- `next/image` - Next.js image optimization

## Best Practices

1. **Status Management:**
   - Always use centralized state hooks (`useMultiplePipelineState`)
   - Report operations via `usePipelineOperations`
   - Start monitoring with `usePipelineMonitoring`
   - Never directly mutate pipeline status

2. **Filter Management:**
   - Keep filters synchronized with URL
   - Use memoization for filtered pipelines
   - Parse filters from URL on mount
   - Update URL when filters change

3. **Operation Handling:**
   - Always set loading state before operations
   - Use optimistic updates for better UX
   - Revert optimistic updates on error
   - Track analytics for all operations

4. **Error Handling:**
   - Use centralized error handler (`handleApiError`)
   - Provide retry functionality where appropriate
   - Show user-friendly error messages
   - Track error analytics

5. **Performance:**
   - Memoize filtered pipelines
   - Use centralized polling (not per-component)
   - Debounce filter changes if needed
   - Lazy load modal components

6. **Responsive Design:**
   - Use appropriate component for screen size
   - Test on both desktop and mobile
   - Ensure touch targets are adequate on mobile
   - Optimize card layout for mobile

## Future Improvements

1. **Advanced Filtering:**
   - Search by pipeline name
   - Filter by date range
   - Filter by transformation type
   - Save filter presets

2. **Bulk Operations:**
   - Select multiple pipelines
   - Bulk stop/resume/delete
   - Bulk tag management

3. **Performance:**
   - Virtual scrolling for large lists
   - Pagination or infinite scroll
   - Optimize API calls (batch requests)

4. **Status Polling:**
   - WebSocket support for real-time updates
   - Configurable polling intervals
   - Smart polling (only poll active pipelines)

5. **UI Enhancements:**
   - Pipeline status history
   - Operation logs
   - Quick actions toolbar
   - Keyboard shortcuts
