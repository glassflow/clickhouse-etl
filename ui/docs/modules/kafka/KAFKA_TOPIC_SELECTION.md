# Kafka Topic Selection Module Documentation

## Overview

The Kafka Topic Selection module handles fetching, selecting, and managing Kafka topics within the application. It provides functionality for browsing available topics, selecting topics with offset configuration, previewing events, managing partition/replica counts, and handling deduplication configuration. The module supports both single-topic (ingest) and dual-topic (join) operations.

## Architecture

### Component Hierarchy

```
KafkaTopicSelector (Main Container)
├── useFetchTopics (Hook - Topic Fetching)
│   └── KafkaApiClient (Service - API Communication)
│       ├── fetchTopics() → /ui-api/kafka/topics
│       └── fetchTopicDetails() → /ui-api/kafka/topic-details
│
├── useKafkaTopicSelectorState (Hook - State Management)
│   ├── useFetchEvent (Hook - Event Fetching)
│   │   └── KafkaApiClient.fetchEvent() → /ui-api/kafka/events
│   ├── TopicsStore (State Management)
│   ├── DeduplicationStore (State Management)
│   ├── JoinStore (State Management)
│   └── ClickhouseDestinationStore (State Management)
│
├── TopicSelectWithEventPreview (Presentation Component)
│   ├── TopicOffsetSelect (Topic & Offset Selection)
│   ├── ReplicaCount (Replica Count Selection)
│   ├── EventManager (Event Preview & Navigation)
│   └── SelectDeduplicateKeys (Deduplication Configuration)
│
├── TopicChangeConfirmationModal (Confirmation Dialog)
└── FormActions (Submit/Discard Actions)
```

## Core Components

### 1. KafkaTopicSelector

**Location:** `src/modules/kafka/KafkaTopicSelector.tsx`

**Purpose:** The main container component that orchestrates the topic selection flow. It coordinates topic fetching, state management, event preview, and form submission.

**Key Responsibilities:**
- Manages topic fetching with retry logic
- Coordinates topic selection state via `useKafkaTopicSelectorState`
- Handles topic change confirmation in edit mode
- Manages form submission and validation
- Integrates with validation engine for dependent section invalidation
- Supports both creation and edit (standalone) modes

**Key Features:**

#### Topic Fetching Logic
- Automatically fetches topics on mount if `availableTopics` is empty
- Retries up to 3 times if fetch fails
- Fetches topic details (partition counts) when topics are available but details aren't
- Updates partition count and replica count when topic details are fetched

#### Topic Change Handling
- In edit mode, shows confirmation modal before changing topic
- Warns user about dependent sections that will be invalidated
- Updates replica count to match partition count when topic changes

#### Form Submission
- In creation mode: Moves to next step after submission
- In edit mode: Marks section as valid, marks config as dirty, closes modal
- Uses smart invalidation logic to only invalidate dependents when schema changes

**Props:**
```typescript
{
  steps: any
  onCompleteStep: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  currentStep?: string
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  enableDeduplication?: boolean
  onDeduplicationChange?: (config: DeduplicationConfig) => void
  initialDeduplicationConfig?: Partial<DeduplicationConfig>
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}
```

### 2. useFetchTopics Hook

**Location:** `src/hooks/useFetchKafkaTopics.ts`

**Purpose:** Provides functionality to fetch available topics and topic details (partition counts) from Kafka.

**API:**
```typescript
{
  topics: string[]
  topicDetails: Array<{ name: string; partitionCount: number }>
  isLoadingTopics: boolean
  topicsError: string | null
  fetchTopics: () => Promise<void>
  getPartitionCount: (topicName: string) => number
}
```

**Fetching Flow:**
1. Validates Kafka connection details are present
2. Sets loading state to `true`
3. Fetches topics and topic details in sequence (not parallel currently)
4. Updates state with fetched topics and details
5. Handles errors with retry logic (up to 3 attempts)
6. Shows notifications on failure with retry option

**Topic Details:**
- Fetches partition count for each topic
- Used to auto-set replica count when topic is selected
- Important for edit mode where topics are hydrated but partition counts may be missing

### 3. useKafkaTopicSelectorState Hook

**Location:** `src/modules/kafka/hooks/useKafkaTopicSelectorState.ts`

**Purpose:** Centralized state management hook for topic selection. Manages topic selection, offset selection, event fetching, deduplication configuration, and submission logic.

**State Managed:**
- Topic name and selection
- Offset (earliest/latest)
- Event data and navigation
- Replica count
- Partition count
- Deduplication configuration
- Manual event input
- Loading and error states

**Key Functions:**

#### `selectTopic(newTopicName: string)`
- Updates topic name in local state and store
- Clears events when topic changes (new topic = different events)
- Preserves other properties (offset, replicas) from current topic
- Synchronizes join store if join is enabled
- Tracks analytics event

#### `selectOffset(newOffset: 'earliest' | 'latest')`
- Updates offset in local state and store
- Clears events when offset changes (different offset = different events)
- Preserves other properties from current topic

#### `selectReplicaCount(newReplicaCount: number)`
- Updates replica count in local state and store
- Preserves ALL existing topic data (including events)
- Only updates the replica count field

#### `updatePartitionCount(newPartitionCount: number)`
- Updates partition count in store
- Preserves ALL existing topic data
- Used when topic details are fetched

#### `submit()`
The most complex function, handles:
1. **Event Resolution:**
   - Uses manual event if provided and valid
   - Falls back to fetched event from state
   - Handles edge cases for missing events

2. **Schema Comparison:**
   - Compares previous event schema with new event schema
   - Uses `originalTopicRef` to track state before changes
   - Only invalidates dependents if schema actually changed

3. **Smart Invalidation:**
   - **Topic changed:** Always invalidate (regardless of schema)
   - **Same topic, schema changed:** Invalidate
   - **Same topic, schema unchanged:** Don't invalidate (offset/replica changes)
   - **First event selection:** Always invalidate

4. **Dependent Section Management:**
   - Clears join store when schema/topic changes
   - Clears or invalidates deduplication based on context
   - Clears field mappings in clickhouse destination
   - Triggers validation engine to show red borders

5. **Store Updates:**
   - Updates topic in `topicsStore`
   - Updates deduplication in `deduplicationStore`
   - Marks configuration as dirty in edit mode

**Event Navigation:**
- `fetchNewestEvent(topicName)` - Fetches latest event
- `fetchOldestEvent(topicName)` - Fetches earliest event
- `fetchNextEvent(topicName, currentOffset)` - Fetches next event
- `fetchPreviousEvent(topicName, currentOffset)` - Fetches previous event
- `refreshEvent(topicName, fetchNext?)` - Refreshes current event

**Deduplication Configuration:**
- `configureDeduplication(keyConfig, windowConfig)` - Updates deduplication config
- Validates that both key and window are configured
- Updates `deduplicationStore` and tracks analytics

### 4. TopicSelectWithEventPreview

**Location:** `src/modules/kafka/components/TopicSelectWithEventPreview.tsx`

**Purpose:** Presentation component that displays topic selection form and event preview side-by-side.

**Layout:**
- **Left Side (2/5 width):** Form fields
  - Topic selector dropdown
  - Offset selector (earliest/latest)
  - Replica count selector (when topic selected)
  - Deduplication configuration (when enabled)
- **Right Side (3/5 width):** Event preview
  - EventManager component for viewing/navigating events

**Features:**
- Supports both hook-provided data and local state fallback
- Handles topic change, offset change, and manual event input
- Displays loading states during event fetching
- Shows error messages when event fetch fails
- Disables topic change in read-only mode (configurable via `disableTopicChange` prop)

### 5. TopicChangeConfirmationModal

**Location:** `src/modules/kafka/components/TopicChangeConfirmationModal.tsx`

**Purpose:** Confirmation dialog shown when user attempts to change topic in edit mode.

**Features:**
- Lists sections that will be invalidated based on operation type:
  - **ingest:** Field Mapping
  - **deduplication:** Deduplication Configuration, Field Mapping
  - **join:** Join Configuration, Field Mapping
  - **deduplication-join:** All three sections
- Warns user that sections will show red borders
- Requires explicit confirmation before proceeding

### 6. useGetIndex Hook

**Location:** `src/modules/kafka/useGetIndex.ts`

**Purpose:** Determines the topic index (0 or 1) based on the current step name.

**Logic:**
- `TOPIC_SELECTION_1` or `TOPIC_DEDUPLICATION_CONFIGURATOR_1` → index 0
- `TOPIC_SELECTION_2` or `TOPIC_DEDUPLICATION_CONFIGURATOR_2` → index 1
- Default → index 0

**Why:**
- More reliable than using `operationsSelected` during editing
- Step names are consistent across create and edit modes
- Supports dual-topic operations (join)

## State Management

### TopicsStore

**Location:** `src/store/topics.store.ts`

**Purpose:** Manages all topic-related state using Zustand.

**State Structure:**
```typescript
{
  // Available topics from Kafka
  availableTopics: string[]

  // Number of topics in pipeline (1 or 2)
  topicCount: number

  // Topics data indexed by topic index (0 or 1)
  topics: {
    [index: number]: {
      index: number
      name: string
      initialOffset: 'earliest' | 'latest'
      events: Array<{
        event: any
        topicIndex: number
        position: 'earliest' | 'latest'
        isManualEvent?: boolean
      }>
      selectedEvent: {
        event: any
        topicIndex: number
        position: 'earliest' | 'latest'
        isManualEvent?: boolean
      }
      replicas: number
      partitionCount: number
    }
  }

  // Validation state
  validation: ValidationState
}
```

**Actions:**
- `setAvailableTopics(topics: string[])` - Sets available topics list
- `setTopicCount(count: number)` - Sets number of topics
- `updateTopic(topic: KafkaTopicType)` - Updates topic data (auto-marks as valid)
- `getTopic(index: number)` - Gets topic by index
- `getEvent(index: number, eventIndex: number)` - Gets event by topic and event index
- `invalidateTopicDependentState(index: number)` - Cleans topic and invalidates dependents
- `resetTopicsStore()` - Resets all topic state

**Topic Update Behavior:**
- When `updateTopic` is called, validation is automatically set to valid
- Topic data is stored by index, allowing multiple topics (for join operations)
- Events are stored as an array, with `selectedEvent` pointing to the current event

**Dependent State Invalidation:**
When `invalidateTopicDependentState` is called:
1. Clears join store (disables join, clears type and streams)
2. Invalidates deduplication for the topic index
3. Cleans topic data, keeping only:
   - name
   - index
   - initialOffset
   - Empty events array
   - Empty selectedEvent

## Event Fetching

### useFetchEvent Hook

**Location:** `src/hooks/useFetchKafkaEvents.ts`

**Purpose:** Provides functionality to fetch individual events from Kafka topics.

**API:**
```typescript
{
  fetchEvent: (topic: string, getNext: boolean, options?: FetchOptions) => Promise<void>
  event: any
  isLoadingEvent: boolean
  eventError: string | null
  hasMoreEvents: boolean
  hasOlderEvents: boolean
  resetEventState: () => void
  currentOffset: number | null
}
```

**Fetch Options:**
```typescript
{
  direction?: 'next' | 'previous'
  position?: 'earliest' | 'latest'
}
```

**Fetching Flow:**
1. Validates topic is provided
2. Checks edge cases (already at first/last event)
3. Sets loading state and clears errors
4. Sets timeout (30 seconds)
5. Calls `kafkaApiClient.fetchEvent()` with Kafka connection details
6. Updates event, offset, and navigation flags
7. Handles errors with specific messages:
   - "No more events available" - end of topic
   - "No previous events available" - beginning of topic
   - Timeout errors with retry option

**Navigation State:**
- `hasMoreEvents` - True if there are newer events
- `hasOlderEvents` - True if there are older events
- `currentOffset` - Current Kafka offset of displayed event
- Set based on position (earliest/latest) and API response

**Error Handling:**
- Shows notifications for errors
- Provides retry callbacks in notifications
- Handles timeout scenarios gracefully
- Falls back to mock data when appropriate

### KafkaApiClient

**Location:** `src/services/kafka-api-client.ts`

**Purpose:** Service class for making Kafka API requests.

**Methods:**

#### `fetchTopics(kafka: KafkaStore)`
- Builds request body with auth headers
- POSTs to `/ui-api/kafka/topics`
- Returns list of topic names

#### `fetchTopicDetails(kafka: KafkaStore)`
- Builds request body with auth headers
- POSTs to `/ui-api/kafka/topic-details`
- Returns array of `{ name: string, partitionCount: number }`

#### `fetchEvent(kafka: KafkaStore, options: FetchEventRequest)`
- Builds request body with auth headers and event options
- POSTs to `/ui-api/kafka/events`
- Returns event data, offset, and metadata

**Auth Header Building:**
- Extracts connection details from `kafkaStore`
- Adds auth-specific fields based on auth method
- Includes certificates and skipTlsVerification for SSL protocols
- Supports all authentication methods (same as connection module)

## Topic Selection Flow

### Standard Flow (Pipeline Creation)

1. **Initialization:**
   - Component mounts, `useFetchTopics` hook initializes
   - If `availableTopics` is empty, automatically fetches topics
   - If topics exist but details don't, fetches topic details
   - Initializes state from store if returning to form

2. **Topic Selection:**
   - User selects topic from dropdown
   - `selectTopic` is called, updates store
   - Partition count is fetched and used to set replica count
   - Event fetching is triggered based on selected offset

3. **Offset Selection:**
   - User selects earliest or latest offset
   - `selectOffset` is called, updates store
   - Event fetching is triggered for selected offset

4. **Event Preview:**
   - Event is fetched via `useFetchEvent` hook
   - Event is displayed in EventManager component
   - User can navigate events (next/previous/newest/oldest)
   - User can manually paste event JSON

5. **Deduplication (if enabled):**
   - User selects deduplication key from event
   - User configures deduplication window
   - Configuration is saved to `deduplicationStore`

6. **Submission:**
   - User clicks "Continue"
   - `submit()` is called:
     - Resolves final event (manual or fetched)
     - Compares schema with previous event
     - Updates stores (topics, deduplication)
     - Invalidates dependents if schema changed
   - Step is completed, moves to next step

### Edit Mode Flow (Standalone)

1. **Initialization:**
   - Form is initialized with existing topic data from store
   - `originalTopicRef` captures initial state for comparison
   - Topics are hydrated but may need partition count refresh

2. **Topic Change:**
   - User attempts to change topic
   - Confirmation modal is shown
   - If confirmed:
     - Topic is updated
     - Events are cleared
     - Partition count is fetched and replica count updated

3. **Other Changes:**
   - User can change offset, replica count, deduplication
   - Changes are tracked in form state
   - No confirmation needed for non-topic changes

4. **Submission:**
   - User clicks "Save"
   - `submit()` is called:
     - Compares current state with `originalTopicRef`
     - Only invalidates if schema actually changed
     - Marks section as valid (not `onSectionConfigured`)
     - Marks config as dirty
   - Modal/form is closed

## Smart Invalidation Logic

The module uses intelligent invalidation to avoid unnecessary reconfiguration:

### Invalidation Triggers

1. **Topic Name Changed:**
   - Always invalidate (regardless of schema)
   - Reason: Different topic = different data source

2. **Schema Changed (Same Topic):**
   - Invalidate if event schema differs
   - Reason: Field mappings need to be updated

3. **Schema Unchanged (Same Topic):**
   - Don't invalidate if only offset/replica changed
   - Reason: Schema is the same, mappings still valid

4. **First Event Selection:**
   - Always invalidate
   - Reason: No previous schema to compare

### Schema Comparison

Uses `compareEventSchemas(previousEvent, finalEvent)` utility:
- Compares field names and types
- Ignores field values
- Returns `true` if schemas match, `false` otherwise

### Dependent Sections

When invalidation occurs:
- **Join Store:** Cleared (disabled, type cleared, streams cleared)
- **Deduplication Store:** Cleared or invalidated based on context
- **Clickhouse Destination:** Field mappings cleared
- **Validation Engine:** Sections marked as invalidated (red borders)

## Index Management

The module supports dual-topic operations (join) using index-based storage:

- **Index 0:** First topic (left side in join operations)
  - Steps: `TOPIC_SELECTION_1`, `TOPIC_DEDUPLICATION_CONFIGURATOR_1`
- **Index 1:** Second topic (right side in join operations)
  - Steps: `TOPIC_SELECTION_2`, `TOPIC_DEDUPLICATION_CONFIGURATOR_2`

The `useGetIndex` hook determines the index based on step name, which is more reliable than using `operationsSelected` during editing.

## API Endpoints

### Fetch Topics
- **Endpoint:** `POST /ui-api/kafka/topics`
- **Request Body:** Kafka connection details (same as connection test)
- **Response:**
  ```typescript
  {
    success: boolean
    topics?: string[]
    error?: string
  }
  ```

### Fetch Topic Details
- **Endpoint:** `POST /ui-api/kafka/topic-details`
- **Request Body:** Kafka connection details
- **Response:**
  ```typescript
  {
    success: boolean
    topicDetails?: Array<{ name: string; partitionCount: number }>
    error?: string
  }
  ```

### Fetch Event
- **Endpoint:** `POST /ui-api/kafka/events`
- **Request Body:**
  ```typescript
  {
    // Kafka connection details
    servers: string
    securityProtocol: string
    authMethod: string
    // ... auth-specific fields
  
    // Event fetch options
    topic: string
    format?: string
    position?: 'earliest' | 'latest'
    direction?: 'next' | 'previous'
    currentOffset?: string
    getNext?: boolean
    runConsumerFirst?: boolean
  }
  ```
- **Response:**
  ```typescript
  {
    success: boolean
    event?: any
    offset?: string
    position?: any
    metadata?: {
      earliestOffset: number
      latestOffset: number
      hasOlderEvents?: boolean
    }
    error?: string
  }
  ```

## Error Handling

1. **Topic Fetch Errors:**
   - Shows notification with retry option
   - Retries up to 3 times automatically
   - Component tracks fetch attempts to prevent infinite loops

2. **Event Fetch Errors:**
   - Shows specific error messages:
     - "No more events available" - end of topic
     - "No previous events available" - beginning of topic
     - Timeout errors with retry option
   - Falls back to mock data when appropriate

3. **Validation Errors:**
   - Form validation prevents submission if:
     - No topic selected
     - No event available (and no valid manual event)
     - Deduplication not configured (when enabled)

## Analytics Integration

The module tracks analytics events via `useJourneyAnalytics`:

- **Page Views:**
  - `analytics.page.selectTopic()` - Single topic selection
  - `analytics.page.selectLeftTopic()` - First topic in join
  - `analytics.page.selectRightTopic()` - Second topic in join
  - `analytics.page.topicDeduplication()` - Deduplication configuration

- **Topic Selection:**
  - `analytics.topic.selected({ offset })` - Topic selected

- **Event Operations:**
  - `analytics.topic.eventReceived({ topicName, offset, position, eventSize, timestamp })` - Event fetched
  - `analytics.topic.noEvent({ topicName, position, reason, timestamp })` - No event available
  - `analytics.topic.eventError({ topicName, position, error, timestamp })` - Event fetch error

- **Deduplication:**
  - `analytics.key.dedupKey({ keyType, window, unit })` - Deduplication configured

## Dependencies

### Internal Dependencies
- `@/src/store` - Global state management (topicsStore, deduplicationStore, joinStore, etc.)
- `@/src/hooks` - Custom hooks (useFetchTopics, useFetchEvent, useJourneyAnalytics)
- `@/src/services` - API clients (kafkaApiClient)
- `@/src/components` - UI components (EventManager, FormActions, etc.)
- `@/src/utils` - Utilities (compareEventSchemas)

### External Dependencies
- `react` - React hooks and components
- `zustand` - State management
- `next/image` - Image optimization

## Best Practices

1. **State Management:**
   - Always use store actions to update topic state
   - Preserve existing data when updating individual fields
   - Use `originalTopicRef` for schema comparison in edit mode

2. **Event Fetching:**
   - Always check for edge cases (beginning/end of topic)
   - Handle timeouts gracefully
   - Provide retry mechanisms for failed fetches

3. **Schema Comparison:**
   - Compare schemas, not values
   - Only invalidate when schema actually changes
   - Preserve user's work when possible

4. **Edit Mode:**
   - Capture original state when entering edit mode
   - Show confirmation for destructive changes (topic change)
   - Use smart invalidation to avoid unnecessary reconfiguration

5. **Error Handling:**
   - Provide clear, actionable error messages
   - Offer retry options where appropriate
   - Fall back gracefully when possible

## Future Improvements

1. **Performance:**
   - Cache topic lists and details
   - Debounce event fetching
   - Optimize re-renders

2. **User Experience:**
   - Show topic metadata (message count, size, etc.)
   - Preview multiple events at once
   - Better loading states

3. **Error Recovery:**
   - Automatic retry with exponential backoff
   - Better timeout handling
   - Offline mode support

4. **Advanced Features:**
   - Topic filtering and search
   - Event schema validation
   - Batch event operations
