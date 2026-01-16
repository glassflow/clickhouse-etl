# Join Configurator Module Documentation

## Overview

The Join Configurator module handles all aspects of configuring temporal joins between two Kafka topics within the pipeline. It provides a comprehensive interface for selecting join keys from each topic's events and configuring time windows during which events from both topics will be joined together. This enables combining data from multiple sources based on matching keys and temporal proximity.

### Key Features

- **Dual Stream Configuration**: Configure join settings for two separate Kafka topics
- **Join Key Selection**: Choose matching identifier fields from each topic's events
- **Time Window Configuration**: Set the duration (up to 7 days) for temporal join matching
- **Event Preview**: Display sample events from both topics for reference
- **Edit Mode Support**: Standalone editing for existing pipeline configurations
- **Validation Integration**: Integrates with validation engine for pipeline flow control
- **Dependency Management**: Invalidates ClickHouse mapping when join configuration changes

### Module Structure

```text
src/modules/join/
├── JoinConfigurator.tsx              # Main container component
└── components/
    ├── StreamConfiguratorList.tsx     # List of two stream configurators
    └── StreamConfigurator.tsx         # Individual stream configuration
```

### Quick Reference

- **Main Component**: `src/modules/join/JoinConfigurator.tsx`
- **State Store**: `src/store/join.store.ts` (Zustand)
- **Key Actions**: `setStreams`, `setEnabled`, `setType`, `getIsJoinDirty`
- **Configuration**: `{ enabled, type, streams: [JoinStream, JoinStream] }` (TypeScript interface)

### Related Modules

- **Kafka Connection**: Provides topic and event data
- **Topic Selection**: Provides the two topics to be joined
- **ClickHouse Mapping**: Uses join configuration for mapping setup
- **Validation Engine**: Coordinates step completion and dependency tracking

## Architecture

### Component Hierarchy

```text
JoinConfigurator (Main Container)
├── StreamConfiguratorList
│   ├── Stream 1 Configuration
│   │   ├── StreamConfigurator
│   │   │   ├── Join Key Selector
│   │   │   └── TimeWindowConfigurator
│   │   └── EventEditor (Stream 1 Preview)
│   └── Stream 2 Configuration
│       ├── StreamConfigurator
│       │   ├── Join Key Selector
│       │   └── TimeWindowConfigurator
│       └── EventEditor (Stream 2 Preview)
└── FormActions
    ├── Continue/Save Button
    └── Discard Changes Button (Edit Mode)
```

## Core Components

### 1. JoinConfigurator

**Location:** `src/modules/join/JoinConfigurator.tsx`

**Purpose:** The main container component that orchestrates the join configuration flow. It manages state, handles configuration updates, coordinates with the store, and supports both creation and edit modes.

**Key Responsibilities:**

- Manages join configuration state from the global store
- Handles join key and time window selection for both streams
- Generates unique stream IDs for each topic
- Supports both standalone (edit mode) and integrated (pipeline creation) flows
- Tracks analytics events for user interactions
- Coordinates with validation engine for step completion
- Invalidates dependent sections (ClickHouse mapping) when join configuration changes

**Props:**

```typescript
{
  steps: any
  onCompleteStep: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  index: number
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}
```

**Key State Management:**

- Reads from `joinStore` for current configuration
- Reads from `topicsStore` for topic and event data
- Reads from `coreStore` for dirty state tracking
- Updates `joinStore` with configuration changes
- Uses `validationEngine` for step validation

**Key Functions:**

#### `handleSubmit()`

Handles form submission. Different behavior for edit mode vs creation mode.

```typescript
const handleSubmit = () => {
  setShowValidation(true)

  if (!validateForm()) {
    notify(dataProcessingMessages.joinConfigurationError('Please fix the errors in the form'))
    return
  }

  // Update store
  setEnabled(true)
  setType('temporal')
  setStreams(
    formData.streams.map((stream, index) => ({
      ...stream,
      orientation: index === 0 ? 'left' : 'right',
      topicName: index === 0 ? topic1?.name || '' : topic2?.name || '',
    })),
  )

  // Track analytics...
  analytics.join.configurationCompleted({...})

  // Trigger validation engine
  validationEngine.onSectionConfigured(StepKeys.JOIN_CONFIGURATOR)

  if (standalone) {
    // Edit mode: save and stay in section
    coreStore.markAsDirty()
    setIsSaveSuccess(true)
    onCompleteStandaloneEditing?.()
  } else {
    // Creation mode: move to next step
    onCompleteStep(StepKeys.JOIN_CONFIGURATOR as StepKeys)
  }
}
```

**Key Points:**

- Validates form before submission
- Updates store with stream configuration including orientation and topic names
- Marks section as configured in validation engine
- In edit mode: marks pipeline as dirty and closes edit form
- In creation mode: proceeds to next step
- Tracks analytics for configuration completion

#### `handleFieldChange(streamIndex, field, value)`

Handles field changes for join configuration.

```typescript
const handleFieldChange = (streamIndex: number, field: string, value: any) => {
  setUserInteracted(true)
  setFormData((prev) => ({
    streams: prev.streams.map((stream, index) =>
      (index === streamIndex ? { ...stream, [field]: value } : stream)
    ),
  }))

  // Track analytics...
  analytics.join.fieldChanged({...})

  // Track specific join key selection
  if (field === 'joinKey' && value) {
    if (streamIndex === 0) {
      analytics.key.leftJoinKey({...})
    } else {
      analytics.key.rightJoinKey({...})
    }
  }

  // Invalidate dependent sections
  validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, 'Join configuration changed')
}
```

**Key Points:**

- Updates local form state
- Tracks user interaction
- Tracks analytics for field changes and key selections
- Invalidates ClickHouse mapping when join configuration changes (join affects mapping)

#### `handleDiscardChanges()`

Handles discard changes button click in edit mode.

```typescript
const handleDiscardChanges = () => {
  // Discard join section
  coreStore.discardSection('join')
}
```

**Key Points:**

- Discards changes to join section
- Restores original configuration from pipeline data
- Only available in edit mode

#### `validateForm()`

Validates the join configuration form.

```typescript
const validateForm = () => {
  const newErrors: { [key: string]: string } = {}
  let isValid = true

  formData.streams.forEach((stream, index) => {
    if (!stream.joinKey) {
      newErrors[`streams.${index}.joinKey`] = 'Join key is required'
      isValid = false
    }
    if (!stream.joinTimeWindowValue || stream.joinTimeWindowValue < 1) {
      newErrors[`streams.${index}.joinTimeWindowValue`] = 'Time window value must be at least 1'
      isValid = false
    }
    if (!stream.joinTimeWindowUnit) {
      newErrors[`streams.${index}.joinTimeWindowUnit`] = 'Time window unit is required'
      isValid = false
    }
  })

  setErrors(newErrors)
  setFormIsValid(isValid)
  return isValid
}
```

**Key Points:**

- Validates both streams independently
- Requires join key, time window value (>= 1), and time window unit for each stream
- Returns validation result and updates errors state

**Stream ID Generation:**

The component generates unique stream IDs when topics are available:

```typescript
useEffect(() => {
  if (topic1?.name && topic2?.name) {
    const streamId1 = streams?.[0]?.streamId || `${topic1.name}_${uuidv4().slice(0, 8)}`
    const streamId2 = streams?.[1]?.streamId || `${topic2.name}_${uuidv4().slice(0, 8)}`

    setFormData((prev) => ({
      streams: [
        { ...prev.streams[0], streamId: streamId1 },
        { ...prev.streams[1], streamId: streamId2 },
      ],
    }))
  }
}, [topic1?.name, topic2?.name, streams])
```

**Key Points:**

- Generates stream IDs based on topic names with UUID suffix
- Preserves existing stream IDs if already set
- Ensures unique identifiers for each stream

**Returning to Completed Form:**

The component handles returning to a previously completed step:

```typescript
useEffect(() => {
  if (isReturningToForm && streams?.length === 2 && !userInteracted) {
    const hasCompleteData = streams.every(
      (stream) => stream?.streamId && stream?.joinKey && stream?.joinTimeWindowValue && stream?.joinTimeWindowUnit,
    )

    if (hasCompleteData) {
      setFormData({
        streams: streams.map((stream) => ({
          streamId: stream.streamId,
          joinKey: stream.joinKey,
          joinTimeWindowValue: stream.joinTimeWindowValue,
          joinTimeWindowUnit: stream.joinTimeWindowUnit,
        })),
      })
      setFormIsValid(true)
    }
  }
}, [isReturningToForm, streams, userInteracted])
```

**Key Points:**

- Restores form data from store when returning to completed step
- Only restores if complete data exists and user hasn't interacted yet
- Sets form as valid if data is complete

### 2. StreamConfiguratorList

**Location:** `src/modules/join/components/StreamConfiguratorList.tsx`

**Purpose:** Renders two stream configurators side-by-side with event previews for each stream.

**Key Features:**

- Displays two stream configurations in a responsive layout
- Shows event previews for both streams
- Tracks analytics for join key selections
- Handles read-only mode

**Props:**

```typescript
{
  streams: {
    joinKey: string
    joinTimeWindowValue: number
    joinTimeWindowUnit: string
  }[]
  dynamicOptions: {
    streams: {
      joinKey: { label: string; value: string }[]
      joinTimeWindowUnit: { label: string; value: string }[]
    }[]
  }
  onChange: (streamIndex: number, field: string, value: any) => void
  errors?: { [key: string]: string }
  event1: any
  event2: any
  topic1: any
  topic2: any
  readOnly?: boolean
}
```

**Layout Structure:**

- **Stream 1**: Configuration form (left) + Event preview (right)
- **Stream 2**: Configuration form (left) + Event preview (right)
- Responsive: Stacks vertically on small screens, side-by-side on large screens

**Analytics Tracking:**

```typescript
useEffect(() => {
  if (streams[0].joinKey) {
    analytics.key.leftJoinKey({
      key: streams[0].joinKey,
    })
  }
}, [streams[0].joinKey])

useEffect(() => {
  if (streams[1].joinKey) {
    analytics.key.rightJoinKey({
      key: streams[1].joinKey,
    })
  }
}, [streams[1].joinKey])
```

**Key Points:**

- Tracks join key selection for both streams separately
- Uses different analytics events for left and right streams
- Only tracks when join key is set

### 3. StreamConfigurator

**Location:** `src/modules/join/components/StreamConfigurator.tsx`

**Purpose:** Provides the UI for configuring a single stream's join key and time window.

**Key Features:**

- Join key selection from available event fields
- Time window configuration with validation
- Error display for validation failures
- Read-only mode support

**Props:**

```typescript
{
  streamIndex: number
  stream: {
    joinKey: string
    joinTimeWindowValue: number
    joinTimeWindowUnit: string
  }
  availableKeys: { label: string; value: string }[]
  onChange: (streamIndex: number, field: string, value: any) => void
  errors?: {
    joinKey?: string
    joinTimeWindowValue?: string
  }
  readOnly?: boolean
}
```

**Time Window Validation:**

The component uses the shared `TimeWindowConfigurator` component from the deduplication module, which validates against a maximum of 7 days:

```typescript
const MAX_DAYS = 7
const HOURS_IN_DAY = 24
const MINUTES_IN_HOUR = 60
const SECONDS_IN_MINUTE = 60

const MAX_HOURS = MAX_DAYS * HOURS_IN_DAY
const MAX_MINUTES = MAX_HOURS * MINUTES_IN_HOUR
const MAX_SECONDS = MAX_MINUTES * SECONDS_IN_MINUTE
```

**Key Points:**

- Reuses `TimeWindowConfigurator` from deduplication module
- Maximum time window is 7 days (same as deduplication)
- Validates time window values based on selected unit
- Displays errors inline

## State Management

### JoinStore

**Location:** `src/store/join.store.ts`

**Purpose:** Manages all join configuration state using Zustand.

**State Structure:**

```typescript
{
  enabled: boolean
  type: string
  streams: JoinStream[]
  validation: ValidationState
}
```

**JoinStream Interface:**

```typescript
{
  streamId: string
  topicName: string
  joinKey: string
  joinTimeWindowValue: number
  joinTimeWindowUnit: string
  orientation: 'left' | 'right'
}
```

**Key Actions:**

#### `setStreams(streams: JoinStream[])`

Updates join streams configuration.

```typescript
setStreams: (streams: JoinStream[]) =>
  set((state) => ({
    joinStore: {
      ...state.joinStore,
      streams: streams.map((stream) => ({
        topicName: stream.topicName,
        streamId: stream.streamId,
        joinKey: stream.joinKey,
        joinTimeWindowValue: stream.joinTimeWindowValue,
        joinTimeWindowUnit: stream.joinTimeWindowUnit,
        orientation: stream.orientation,
      })),
      validation: createValidValidation(), // Auto-mark as valid when streams are set
    },
  }))
```

**Key Points:**

- Stores configuration for both streams
- Automatically marks validation as valid when updated
- Preserves all stream properties including orientation

#### `setEnabled(enabled: boolean)`

Enables or disables join functionality.

```typescript
setEnabled: (enabled: boolean) => set((state) => ({ joinStore: { ...state.joinStore, enabled } }))
```

#### `setType(type: string)`

Sets the join type (currently only 'temporal' is supported).

```typescript
setType: (type: string) => set((state) => ({ joinStore: { ...state.joinStore, type } }))
```

#### `getIsJoinDirty()`

Checks if join configuration has been set.

```typescript
getIsJoinDirty: () => {
  const { streams } = get().joinStore
  return streams.length > 0
}
```

**Key Points:**

- Returns true if any streams are configured
- Used to determine if join section needs to be saved

#### `resetJoinStore()`

Resets entire join store to initial state.

```typescript
resetJoinStore: () => set((state) => ({ joinStore: { ...state.joinStore, ...initialJoinStore } }))
```

**Validation Methods:**

The store implements `ValidationMethods` interface:

- `markAsValid()` - Marks join configuration as valid
- `markAsInvalidated(invalidatedBy)` - Marks as invalidated with reason
- `markAsNotConfigured()` - Marks as not configured
- `resetValidation()` - Resets validation state

## Data Flow

### Pipeline Creation Flow

1. **User selects two Kafka topics**
   - Topic data is stored in `topicsStore`
   - Event data is available for field extraction
   - Topics are indexed (topic1 at index, topic2 at index + 1)

2. **User enters join configuration step**
   - `JoinConfigurator` mounts
   - Reads topic and event data from store
   - Extracts available fields from both events
   - Generates unique stream IDs for each topic
   - Initializes configuration from store (if exists)

3. **User selects join keys**
   - `StreamConfigurator` displays available fields for each stream
   - User selects a field from dropdown for stream 1
   - User selects a field from dropdown for stream 2
   - `handleFieldChange` updates local state and tracks analytics
   - Changes propagate to store

4. **User configures time windows**
   - User enters window size (number) for each stream
   - User selects time unit (seconds, minutes, hours, days) for each stream
   - `TimeWindowConfigurator` validates against maximum (7 days)
   - Changes propagate to store

5. **User clicks "Continue"**
   - `handleSubmit` is called
   - Form validation is performed
   - If valid:
     - Store is updated with stream configuration
     - Validation engine marks section as configured
     - `onCompleteStep` is called to proceed to next step
     - Configuration is persisted in store

### Pipeline Edit Flow

1. **User opens existing pipeline in edit mode**
   - Pipeline data is hydrated from API
   - Join configuration is restored to store
   - Component initializes with existing configuration

2. **User enters edit mode for join section**
   - `JoinConfigurator` renders in standalone mode
   - `readOnly` is set to false
   - User can modify join keys or time windows for either stream

3. **User saves changes**
   - `handleSubmit` is called
   - `coreStore.markAsDirty()` marks pipeline as needing backend sync
   - Success state is set for UI feedback
   - `onCompleteStandaloneEditing` closes edit form

4. **Changes are persisted**
   - On pipeline save, dirty sections are sent to backend
   - Join configuration is updated in backend
   - Pipeline is resumed with new configuration

## Integration Points

### With Topic Selection

The component reads topic data from `topicsStore`:

```typescript
const topic1 = getTopic(index)
const topic2 = getTopic(index + 1)
const event1 = topic1?.events?.[0]?.event || topic1?.selectedEvent?.event
const event2 = topic2?.events?.[0]?.event || topic2?.selectedEvent?.event
```

**Key Points:**

- Uses topic index to get first and second topics
- Falls back to `selectedEvent` if events array is not available
- Extracts event fields for join key selection

### With Validation Engine

The component integrates with the validation engine for step completion:

**Section Configuration:**

```typescript
validationEngine.onSectionConfigured(StepKeys.JOIN_CONFIGURATOR)
```

**Dependency Invalidation:**

```typescript
validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, 'Join configuration changed')
```

**Key Points:**

- Marks section as configured when saved
- Invalidates ClickHouse mapping when join configuration changes
- Integrates with overall pipeline validation flow
- Prevents progression if configuration is incomplete

### With ClickHouse Mapping

The join configuration affects ClickHouse mapping:

**Mapping Integration:**

- Join configuration is used to determine which fields need to be mapped
- Join keys are tracked in mapping configuration
- Mapping is invalidated when join configuration changes
- Join affects the structure of the output event

**Key Points:**

- Join configuration changes require re-evaluation of ClickHouse mapping
- Mapping must account for joined fields from both streams
- Changes to join keys may affect column mappings

### With Core Store

The component integrates with the core store for dirty state tracking:

**Dirty State Management:**

```typescript
if (standalone) {
  coreStore.markAsDirty()
  // ...
}
```

**Discard Functionality:**

```typescript
const handleDiscardChanges = () => {
  coreStore.discardSection('join')
}
```

**Key Points:**

- Marks pipeline as dirty when changes are made in edit mode
- Ensures changes are sent to backend on pipeline save
- Supports discard functionality to revert changes

## Utilities

### `extractEventFields(data, prefix?)`

**Location:** `src/utils/common.client.ts`

**Purpose:** Extracts fields from event data with support for nested objects and arrays.

**Process:**

1. Recursively traverses object structure
2. Extracts field paths with dot notation (e.g., `user.address.city`)
3. Handles arrays (adds array field itself)
4. Skips `_metadata` fields

**Returns:** `string[]` - Array of field paths

**Key Points:**

- Supports nested objects
- Handles arrays appropriately
- Used to populate join key dropdown options
- Provides field paths for both streams

**Usage in Join Configurator:**

```typescript
const dynamicOptions = {
  streams: [
    {
      joinKey:
        extractEventFields(event1)?.map((key) => ({
          label: key,
          value: key,
        })) || [],
      // ...
    },
    {
      joinKey:
        extractEventFields(event2)?.map((key) => ({
          label: key,
          value: key,
        })) || [],
      // ...
    },
  ],
}
```

## Analytics Integration

The component tracks analytics events via `useJourneyAnalytics`:

**Page View:**

```typescript
analytics.page.joinKey({
  mode: standalone ? 'edit' : 'create',
  readOnly,
  hasExistingData: isReturningToForm,
  timestamp: new Date().toISOString(),
})
```

- Tracked when component loads
- Indicates user entered join configuration step

**Configuration Started:**

```typescript
analytics.join.configurationStarted({
  mode: standalone ? 'edit' : 'create',
  readOnly,
  hasExistingData: isReturningToForm,
  leftTopicName: topic1?.name,
  rightTopicName: topic2?.name,
  timestamp: new Date().toISOString(),
})
```

- Tracked when user starts configuring join
- Includes topic names for context

**Field Changed:**

```typescript
analytics.join.fieldChanged({
  field,
  value: typeof value === 'string' ? value : JSON.stringify(value),
  streamIndex,
  streamId: formData.streams[streamIndex]?.streamId,
  topicName: streamIndex === 0 ? topic1?.name : topic2?.name,
  streamOrientation: streamIndex === 0 ? 'left' : 'right',
  timestamp: new Date().toISOString(),
})
```

- Tracked when any field is changed
- Includes field name, value, stream index, and orientation

**Join Key Selection:**

```typescript
if (field === 'joinKey' && value) {
  if (streamIndex === 0) {
    analytics.key.leftJoinKey({
      joinKey: value,
      topicName: topic1?.name,
      streamId: formData.streams[streamIndex]?.streamId,
      timestamp: new Date().toISOString(),
    })
  } else {
    analytics.key.rightJoinKey({
      joinKey: value,
      topicName: topic2?.name,
      streamId: formData.streams[streamIndex]?.streamId,
      timestamp: new Date().toISOString(),
    })
  }
}
```

- Tracked when join key is selected
- Separate events for left and right streams

**Configuration Completed:**

```typescript
analytics.join.configurationCompleted({
  joinType: 'temporal',
  leftStream: {
    streamId: formData.streams[0].streamId,
    joinKey: formData.streams[0].joinKey,
    timeWindow: `${formData.streams[0].joinTimeWindowValue} ${formData.streams[0].joinTimeWindowUnit}`,
    topicName: topic1?.name,
  },
  rightStream: {
    streamId: formData.streams[1].streamId,
    joinKey: formData.streams[1].joinKey,
    timeWindow: `${formData.streams[1].joinTimeWindowValue} ${formData.streams[1].joinTimeWindowUnit}`,
    topicName: topic2?.name,
  },
  timestamp: new Date().toISOString(),
})
```

- Tracked when join configuration is successfully saved
- Includes complete configuration for both streams

**Key Points:**

- Tracks user interactions for product analytics
- Helps understand user behavior
- Includes relevant context (topic names, stream orientation, time windows)

## Error Handling

### Missing Topic Data

```typescript
const topic1 = getTopic(index)
const topic2 = getTopic(index + 1)
```

**Key Points:**

- Component assumes topics exist at specified indices
- If topics are missing, event extraction will fail gracefully
- Empty arrays are returned for missing event data

### Missing Event Data

```typescript
const event1 = topic1?.events?.[0]?.event || topic1?.selectedEvent?.event
const event2 = topic2?.events?.[0]?.event || topic2?.selectedEvent?.event
```

**Key Points:**

- Falls back to `selectedEvent` if events array is not available
- If no event data, join key dropdown will be empty
- User cannot proceed without selecting join keys

### Form Validation Errors

```typescript
const validateForm = () => {
  const newErrors: { [key: string]: string } = {}
  let isValid = true

  formData.streams.forEach((stream, index) => {
    if (!stream.joinKey) {
      newErrors[`streams.${index}.joinKey`] = 'Join key is required'
      isValid = false
    }
    // ... more validation
  })

  setErrors(newErrors)
  setFormIsValid(isValid)
  return isValid
}
```

**Key Points:**

- Validates both streams independently
- Displays errors inline with form fields
- Prevents submission if validation fails
- Shows notification for critical errors

### Time Window Validation Errors

Time window validation is handled by `TimeWindowConfigurator` component:

- Validates against maximum time window (7 days)
- Provides user-friendly error messages
- Prevents invalid values from being set

## User Experience Features

### Event Preview

- Displays sample events from both topics
- Helps users understand event structure
- Shows available fields for join key selection
- Read-only display using `EventEditor` component

### Responsive Layout

- Stacks vertically on small screens
- Side-by-side layout on large screens
- Maintains readability across screen sizes

### Success State Feedback

```typescript
const [isSaveSuccess, setIsSaveSuccess] = useState(false)

// Reset success state when user starts editing again
useEffect(() => {
  if (!readOnly && isSaveSuccess) {
    setIsSaveSuccess(false)
  }
}, [readOnly, isSaveSuccess])
```

**Key Points:**

- Tracks save success for UI feedback
- Resets when user starts editing again
- Provides visual confirmation of save

### Stream ID Generation

- Automatically generates unique stream IDs
- Based on topic names with UUID suffix
- Preserves existing IDs when returning to form

### Returning to Completed Form

- Restores form data from store
- Only restores if complete data exists
- Sets form as valid if data is complete
- Allows user to review and modify existing configuration

## Best Practices

1. **Join Key Selection:**
   - Choose fields that exist in both topics
   - Ensure keys have matching values (same data type and format)
   - Avoid keys with high cardinality if possible
   - Consider data quality and consistency

2. **Time Window Configuration:**
   - Set based on expected event arrival patterns
   - Consider network delays and processing time
   - Balance memory usage with join coverage
   - Test with sample data before deployment

3. **Stream Configuration:**
   - Ensure both streams are fully configured before proceeding
   - Review event previews to verify field availability
   - Verify join keys match between streams

4. **Validation:**
   - Ensure all required fields are configured before proceeding
   - Review validation errors before saving
   - Test join configuration with sample data

5. **Edit Mode:**
   - Review existing configuration before making changes
   - Use discard functionality to revert changes
   - Save changes explicitly (don't rely on auto-save)
   - Be aware that changes invalidate ClickHouse mapping

## Future Improvements

Potential areas for enhancement:

1. **Join Type Support:**
   - Support additional join types (inner, left, right, outer)
   - Support different join strategies
   - Allow configuration of join behavior

2. **Multiple Join Keys:**
   - Support composite join keys (multiple fields)
   - Combine multiple fields for matching
   - Handle key concatenation logic

3. **Advanced Time Window:**
   - Support custom time window expressions
   - Allow different time windows for different keys
   - Support sliding window configurations

4. **Key Validation:**
   - Validate key compatibility between streams
   - Warn about potential mismatches
   - Provide key selection recommendations

5. **Performance Optimization:**
   - Debounce field extraction
   - Cache available keys
   - Optimize re-renders

6. **Schema Integration:**
   - Integrate with schema modifications from KafkaTypeVerification
   - Respect schema changes when selecting join keys
   - Display schema modification notices

## Related Documentation

- [Kafka Connection Module](../kafka/KAFKA_CONNECTION.md) - Topic and event data source
- [Topic Selection](../kafka/KAFKA_TOPIC_SELECTION.md) - Topic selection process
- [ClickHouse Mapping](../clickhouse/CLICKHOUSE_MAPPING.md) - Destination configuration
- [Deduplication Configurator](../deduplication/DEDUPLICATION_CONFIGURATOR.md) - Similar configuration pattern
- [State Management](../../architecture/ARCHITECTURE_OVERVIEW.md) - Store architecture
- [Validation Engine](../../architecture/ARCHITECTURE_OVERVIEW.md) - Validation flow
