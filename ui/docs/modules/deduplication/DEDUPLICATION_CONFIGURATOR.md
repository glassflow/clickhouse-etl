# Deduplication Configurator Module Documentation

## Overview

The Deduplication Configurator module handles all aspects of configuring event deduplication within the pipeline. It provides a comprehensive interface for selecting a unique identifier field from Kafka events and configuring a time window during which duplicate events with the same identifier will be filtered out. This ensures data quality by preventing duplicate records from being processed and stored in ClickHouse.

### Key Features

- **Deduplication Key Selection**: Choose a unique identifier field from Kafka events
- **Time Window Configuration**: Set the duration (up to 7 days) during which duplicates are detected
- **Schema Integration**: Respects schema modifications from KafkaTypeVerification step
- **Edit Mode Support**: Standalone editing for existing pipeline configurations
- **Skip Option**: Option to skip deduplication for ingest-only or join-only pipelines
- **Validation Integration**: Integrates with validation engine for pipeline flow control

### Module Structure

```text
src/modules/deduplication/
├── DeduplicationConfigurator.tsx       # Main container component
└── components/
    ├── SelectDeduplicateKeys.tsx       # Key selection and time window configuration
    ├── TimeWindowConfigurator.tsx       # Time window input component
    └── TopicSelectorForm.tsx           # Topic selection (shared component)
```

### Quick Reference

- **Main Component**: `src/modules/deduplication/DeduplicationConfigurator.tsx`
- **State Store**: `src/store/deduplication.store.ts` (Zustand)
- **Key Actions**: `updateDeduplication`, `skipDeduplication`, `getDeduplication`
- **Configuration**: `{ enabled, window, unit, key, keyType }` (TypeScript interface)

### Related Modules

- **Kafka Connection**: Provides topic and event data
- **Kafka Type Verification**: Provides schema fields and type information
- **ClickHouse Mapping**: Uses deduplication key information for mapping configuration
- **Join Configuration**: Coordinates with join module for multi-topic pipelines

## Architecture

### Component Hierarchy

```text
DeduplicationConfigurator (Main Container)
├── Schema Modification Notice (Conditional)
├── Configuration Section
│   ├── SelectDeduplicateKeys
│   │   ├── Key Selection
│   │   │   ├── SearchableSelect (Field Selection)
│   │   │   └── Key Type Selector (Currently Disabled)
│   │   └── TimeWindowConfigurator
│   │       ├── Window Size Input
│   │       ├── Time Unit Selector
│   │       └── Validation & Tooltips
│   └── EventEditor (Read-only Preview)
│       └── Event Data Display
└── Form Actions
    ├── Skip Deduplication Button (Creation Mode Only)
    └── FormActions Component
        ├── Save/Continue Button
        └── Discard Changes Button (Edit Mode)
```

## Core Components

### 1. DeduplicationConfigurator

**Location:** `src/modules/deduplication/DeduplicationConfigurator.tsx`

**Purpose:** The main container component that orchestrates the deduplication configuration flow. It manages state, handles configuration updates, coordinates with the store, and supports both creation and edit modes.

**Key Responsibilities:**

- Manages deduplication configuration state from the global store
- Handles deduplication key and time window selection
- Integrates with schema modifications from KafkaTypeVerification step
- Supports both standalone (edit mode) and integrated (pipeline creation) flows
- Tracks analytics events for user interactions
- Coordinates with validation engine for step completion
- Handles skip functionality for ingest-only/join-only pipelines

**Props:**

```typescript
{
  onCompleteStep: (stepName: string) => void
  index: number
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}
```

**Key State Management:**

- Reads from `deduplicationStore` for current configuration
- Reads from `topicsStore` for topic and event data
- Reads from `coreStore` for dirty state tracking
- Updates `deduplicationStore` with configuration changes
- Uses `validationEngine` for step validation

**Key Functions:**

#### `handleDeduplicationConfigChange(keyConfig, windowConfig)`

Handles changes to deduplication key and time window configuration.

```typescript
const handleDeduplicationConfigChange = useCallback(
  ({ key, keyType }: { key: string; keyType: string }, { window, unit }: { window: number; unit: string }) => {
    const updatedConfig = {
      enabled: true,
      window,
      unit: unit as 'seconds' | 'minutes' | 'hours' | 'days',
      key,
      keyType,
    }
    updateDeduplication(index, updatedConfig)
    // Track analytics...
  },
  [index, updateDeduplication, analytics.key],
)
```

**Key Points:**

- Creates updated configuration object
- Updates store via `updateDeduplication` action
- Does NOT invalidate ClickHouse mapping (deduplication is independent of field-to-column mappings)
- Tracks analytics for key selection

#### `handleSave()`

Handles save/continue button click. Different behavior for edit mode vs creation mode.

```typescript
const handleSave = useCallback(() => {
  if (!topic?.name) return

  // Mark section as configured
  validationEngine.onSectionConfigured(StepKeys.DEDUPLICATION_CONFIGURATOR)

  const isEditMode = standalone && toggleEditMode

  if (isEditMode) {
    // Edit mode: save and stay in section
    coreStore.markAsDirty()
    setIsSaveSuccess(true)
    onCompleteStandaloneEditing?.()
  } else {
    // Creation mode: move to next step
    onCompleteStep(StepKeys.DEDUPLICATION_CONFIGURATOR as StepKeys)
  }
}, [topic, onCompleteStep, validationEngine, standalone, toggleEditMode])
```

**Key Points:**

- Marks section as configured in validation engine
- In edit mode: marks pipeline as dirty and closes edit form
- In creation mode: proceeds to next step
- Success state is tracked for UI feedback

#### `handleSkip()`

Handles skip button click. Disables deduplication for the topic.

```typescript
const handleSkip = useCallback(() => {
  if (!topic?.name) return

  // Mark deduplication as skipped
  skipDeduplication(index)

  // Mark section as valid (skipping is a valid choice)
  validationEngine.onSectionConfigured(StepKeys.DEDUPLICATION_CONFIGURATOR)

  // Track analytics...
  analytics.key.dedupKey({
    keyType: 'skipped',
    window: 0,
    unit: 'none',
  })

  // Move to next step
  onCompleteStep(StepKeys.DEDUPLICATION_CONFIGURATOR as StepKeys)
}, [topic, index, skipDeduplication, validationEngine, analytics.key, onCompleteStep])
```

**Key Points:**

- Calls `skipDeduplication` to disable deduplication
- Marks section as valid (skipping is a valid configuration choice)
- Only available in creation mode (not in standalone/edit mode)
- Tracks skip action in analytics

#### `handleDiscardChanges()`

Handles discard changes button click in edit mode.

```typescript
const handleDiscardChanges = useCallback(() => {
  // Discard deduplication section
  coreStore.discardSection('deduplication')
}, [coreStore])
```

**Key Points:**

- Discards changes to deduplication section
- Restores original configuration from pipeline data
- Only available in edit mode

**Schema Integration:**

The component integrates with schema modifications from the KafkaTypeVerification step:

```typescript
// Get schema fields from KafkaTypeVerification step
const schemaFields = (topic as any)?.schema?.fields as SchemaField[] | undefined

// Build effective event that reflects schema modifications
const effectiveEventData = useMemo(() => {
  return buildEffectiveEvent(eventData, schemaFields)
}, [eventData, schemaFields])

// Get schema modification info for displaying notices
const schemaModifications = useMemo(() => {
  return getSchemaModifications(schemaFields)
}, [schemaFields])
```

**Schema Modification Notice:**

The component displays a notice when schema has been modified:

```typescript
{(schemaModifications.hasAddedFields || schemaModifications.hasRemovedFields) && (
  <div className="text-sm text-[var(--color-foreground-neutral-faded)] bg-[var(--surface-bg-sunken)] rounded-md px-4 py-3">
    <span className="font-medium">Schema modified:</span>{' '}
    {schemaModifications.hasAddedFields && (
      <span className="text-[var(--color-foreground-primary)]">
        {schemaModifications.addedCount} field{schemaModifications.addedCount !== 1 ? 's' : ''} added
      </span>
    )}
    {schemaModifications.hasAddedFields && schemaModifications.hasRemovedFields && ', '}
    {schemaModifications.hasRemovedFields && (
      <span className="text-[var(--color-foreground-negative)]">
        {schemaModifications.removedCount} field{schemaModifications.removedCount !== 1 ? 's' : ''} removed
      </span>
    )}
    <span className="ml-1">from the original Kafka event.</span>
  </div>
)}
```

**Validation Logic:**

The component determines if the user can continue based on configuration completeness:

```typescript
const canContinue = !!(
  currentDeduplicationConfig.key &&
  currentDeduplicationConfig.window &&
  currentDeduplicationConfig.unit
)
```

**Key Points:**

- Requires key, window, and unit to be set
- Used to disable/enable the Continue button
- Validates configuration before allowing progression

### 2. SelectDeduplicateKeys

**Location:** `src/modules/deduplication/components/SelectDeduplicateKeys.tsx`

**Purpose:** Provides the UI for selecting a deduplication key from available event fields and configuring the time window.

**Key Features:**

- Extracts available keys from event data or schema fields
- Provides searchable select for key selection
- Integrates with TimeWindowConfigurator for time window settings
- Respects schema modifications from KafkaTypeVerification
- Initializes from deduplication store on mount
- Handles loading and error states

**Props:**

```typescript
{
  index: number
  disabled?: boolean
  onChange: (keyConfig: { key: string; keyType: string }, windowConfig: { window: number; unit: string }) => void
  eventData: Record<string, any>
  readOnly?: boolean
  schemaFields?: SchemaField[]
}
```

**Key State:**

```typescript
const [selectedKey, setSelectedKey] = useState('')
const [selectedKeyType, setSelectedKeyType] = useState('string')
const [localWindow, setLocalWindow] = useState(1)
const [localWindowUnit, setLocalWindowUnit] = useState(TIME_WINDOW_UNIT_OPTIONS.HOURS.value)
const [availableKeys, setAvailableKeys] = useState<string[]>([])
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**Field Extraction Logic:**

The component uses a priority-based approach for extracting available keys:

```typescript
useEffect(() => {
  // Initialize from deduplication store
  if (deduplicationConfig) {
    setSelectedKey(deduplicationConfig.key || '')
    setSelectedKeyType(deduplicationConfig.keyType || 'string')
    setLocalWindow(deduplicationConfig.window || 1)
    setLocalWindowUnit(deduplicationConfig.unit || TIME_WINDOW_UNIT_OPTIONS.HOURS.value)
  }

  // Process event data - prefer schema fields if available
  setIsLoading(true)
  setError(null)

  try {
    let keys: string[] = []

    // Priority 1: Schema fields (from KafkaTypeVerification)
    if (schemaFields && schemaFields.length > 0) {
      keys = getEffectiveFieldNames(schemaFields)
    }
    // Priority 2: Extract from event data
    else if (eventData) {
      keys = extractEventFields(eventData)
    }

    if (keys.length > 0) {
      setAvailableKeys(keys)
    } else {
      setError('No keys found in event data')
    }
  } catch (err) {
    console.error('Error processing event data:', err)
    setError('Error processing event data')
  } finally {
    setIsLoading(false)
  }
}, [deduplicationConfig, eventData, schemaFields])
```

**Key Points:**

- Prefers schema fields over raw event data (respects schema modifications)
- Falls back to event data extraction if schema fields not available
- Handles errors gracefully with user-friendly messages
- Initializes local state from store configuration

**Key Selection Handler:**

```typescript
const handleKeySelect = useCallback(
  (key: string | null) => {
    setSelectedKey(key || '')
    setSelectedKeyType('string')
    onChange({ key: key || '', keyType: key ? 'string' : '' }, { window: localWindow, unit: localWindowUnit })
  },
  [selectedKeyType, localWindow, localWindowUnit, onChange],
)
```

**Key Points:**

- Updates local state and calls onChange callback
- Currently always sets keyType to 'string' (key type selector is disabled)
- Propagates changes to parent component immediately

**Time Window Handlers:**

```typescript
const handleWindowChange = useCallback(
  (window: number) => {
    setLocalWindow(window)
    onChange({ key: selectedKey, keyType: selectedKeyType }, { window, unit: localWindowUnit })
  },
  [selectedKey, selectedKeyType, localWindowUnit, onChange],
)

const handleWindowUnitChange = useCallback(
  (unit: string) => {
    setLocalWindowUnit(unit)
    onChange({ key: selectedKey, keyType: selectedKeyType }, { window: localWindow, unit })
  },
  [selectedKey, selectedKeyType, localWindow, onChange],
)
```

**Key Points:**

- Updates local state and propagates to parent
- Maintains consistency between key and window configuration
- Calls onChange callback on every change

### 3. TimeWindowConfigurator

**Location:** `src/modules/deduplication/components/TimeWindowConfigurator.tsx`

**Purpose:** Provides the UI for configuring the deduplication time window (duration and unit).

**Key Features:**

- Number input for window size
- Select dropdown for time unit (seconds, minutes, hours, days)
- Validation for maximum time window (7 days)
- Tooltip with helpful information
- Error display for invalid values
- Read-only mode support

**Props:**

```typescript
{
  window: number
  setWindow: (value: number) => void
  windowUnit: string
  setWindowUnit: (value: string) => void
  label?: string
  tooltip?: string
  readOnly?: boolean
}
```

**Validation Constants:**

```typescript
const MAX_DAYS = 7
const HOURS_IN_DAY = 24
const MINUTES_IN_HOUR = 60
const SECONDS_IN_MINUTE = 60

const MAX_HOURS = MAX_DAYS * HOURS_IN_DAY
const MAX_MINUTES = MAX_HOURS * MINUTES_IN_HOUR
const MAX_SECONDS = MAX_MINUTES * SECONDS_IN_MINUTE
```

**Validation Logic:**

```typescript
const validateTimeWindow = (value: number, unit: string) => {
  switch (unit) {
    case TIME_WINDOW_UNIT_OPTIONS.DAYS.value:
      if (value > MAX_DAYS) {
        setError(`Maximum time window is ${MAX_DAYS} days`)
        return false
      }
      break
    case TIME_WINDOW_UNIT_OPTIONS.HOURS.value:
      if (value > MAX_HOURS) {
        setError(`Maximum time window is ${MAX_HOURS} hours (${MAX_DAYS} days)`)
        return false
      }
      break
    case TIME_WINDOW_UNIT_OPTIONS.MINUTES.value:
      if (value > MAX_MINUTES) {
        setError(`Maximum time window is ${MAX_MINUTES} minutes (${MAX_DAYS} days)`)
        return false
      }
      break
    case TIME_WINDOW_UNIT_OPTIONS.SECONDS.value:
      if (value > MAX_SECONDS) {
        setError(`Maximum time window is ${MAX_SECONDS} seconds (${MAX_DAYS} days)`)
        return false
      }
      break
  }
  setError(null)
  return true
}
```

**Key Points:**

- Validates against maximum time window (7 days) in all units
- Provides user-friendly error messages
- Converts maximum to current unit for clarity
- Validates on initial render and when unit changes

**Change Handlers:**

```typescript
const handleWindowChange = (value: string) => {
  const numValue = parseInt(value)
  if (validateTimeWindow(numValue, windowUnit)) {
    setWindow(numValue)
  }
}

const handleUnitChange = (unit: string) => {
  if (validateTimeWindow(window, unit)) {
    setWindowUnit(unit)
  }
}
```

**Key Points:**

- Validates before updating state
- Prevents invalid values from being set
- Provides immediate feedback to users

## State Management

### DeduplicationStore

**Location:** `src/store/deduplication.store.ts`

**Purpose:** Manages all deduplication configuration state using Zustand.

**State Structure:**

```typescript
{
  deduplicationConfigs: Record<number, DeduplicationConfig>
  validation: ValidationState
}
```

**DeduplicationConfig Interface:**

```typescript
{
  enabled: boolean
  window: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
  key: string
  keyType: string
}
```

**Key Actions:**

#### `updateDeduplication(topicIndex, config)`

Updates deduplication configuration for a topic.

```typescript
updateDeduplication: (topicIndex: number, config: DeduplicationConfig) =>
  set((state) => ({
    deduplicationStore: {
      ...state.deduplicationStore,
      deduplicationConfigs: {
        ...state.deduplicationStore.deduplicationConfigs,
        [topicIndex]: config,
      },
      validation: createValidValidation(), // Auto-mark as valid
    },
  }))
```

**Key Points:**

- Stores configuration indexed by topic index
- Automatically marks validation as valid when updated
- Preserves other topic configurations

#### `getDeduplication(topicIndex)`

Retrieves deduplication configuration for a topic.

```typescript
getDeduplication: (topicIndex: number) => get().deduplicationStore.deduplicationConfigs[topicIndex]
```

#### `skipDeduplication(topicIndex)`

Disables deduplication for a topic (marks as skipped).

```typescript
skipDeduplication: (topicIndex: number) =>
  set((state) => ({
    deduplicationStore: {
      ...state.deduplicationStore,
      deduplicationConfigs: {
        ...state.deduplicationStore.deduplicationConfigs,
        [topicIndex]: {
          enabled: false,
          window: 0,
          unit: 'minutes',
          key: '',
          keyType: '',
        },
      },
      validation: createValidValidation(), // Skipping is valid
    },
  }))
```

**Key Points:**

- Sets enabled to false
- Clears key and window values
- Marks validation as valid (skipping is a valid choice)

#### `invalidateDeduplication(topicIndex)`

Invalidates deduplication configuration (e.g., when topic changes).

```typescript
invalidateDeduplication: (topicIndex: number) =>
  set((state) => ({
    deduplicationStore: {
      ...state.deduplicationStore,
      deduplicationConfigs: {
        ...state.deduplicationStore.deduplicationConfigs,
        [topicIndex]: {
          enabled: true,
          window: 1,
          unit: 'minutes',
          key: '',
          keyType: '',
        },
      },
      validation: createInvalidatedValidation('topic-changed'),
    },
  }))
```

**Key Points:**

- Resets configuration to default values
- Marks validation as invalidated
- Used when topic structure changes

#### `resetDeduplicationStore()`

Resets entire deduplication store to initial state.

```typescript
resetDeduplicationStore: () =>
  set((state) => ({
    deduplicationStore: {
      deduplicationConfigs: {},
      validation: createInitialValidation(),
    },
  }))
```

## Data Flow

### Pipeline Creation Flow

1. **User selects Kafka topic and verifies event structure**
   - Topic data is stored in `topicsStore`
   - Event data is available for field extraction
   - Schema fields are available if type verification was performed

2. **User enters deduplication step**
   - `DeduplicationConfigurator` mounts
   - Reads topic and event data from store
   - Extracts available fields (preferring schema fields)
   - Initializes configuration from store (if exists)

3. **User selects deduplication key**
   - `SelectDeduplicateKeys` displays available fields
   - User selects a field from searchable dropdown
   - `handleKeySelect` updates local state and calls `onChange`
   - `handleDeduplicationConfigChange` updates store

4. **User configures time window**
   - User enters window size (number)
   - User selects time unit (seconds, minutes, hours, days)
   - `TimeWindowConfigurator` validates against maximum (7 days)
   - Changes propagate to store via `onChange` callback

5. **User clicks "Continue"**
   - `handleSave` is called
   - Validation engine marks section as configured
   - `onCompleteStep` is called to proceed to next step
   - Configuration is persisted in store

### Pipeline Edit Flow

1. **User opens existing pipeline in edit mode**
   - Pipeline data is hydrated from API
   - Deduplication configuration is restored to store
   - Component initializes with existing configuration

2. **User enters edit mode for deduplication section**
   - `DeduplicationConfigurator` renders in standalone mode
   - `readOnly` is set to false
   - User can modify key selection or time window

3. **User saves changes**
   - `handleSave` is called
   - `coreStore.markAsDirty()` marks pipeline as needing backend sync
   - Success state is set for UI feedback
   - `onCompleteStandaloneEditing` closes edit form

4. **Changes are persisted**
   - On pipeline save, dirty sections are sent to backend
   - Deduplication configuration is updated in backend
   - Pipeline is resumed with new configuration

### Skip Flow

1. **User clicks "Skip Deduplication" button**
   - Only available in creation mode (not edit mode)
   - `handleSkip` is called

2. **Deduplication is disabled**
   - `skipDeduplication` action is called
   - Configuration is set to disabled state
   - Validation is marked as valid (skipping is valid)

3. **User proceeds to next step**
   - `onCompleteStep` is called
   - Topic becomes ingest-only or join-only
   - No deduplication logic is applied

## Integration Points

### With Kafka Type Verification

The component integrates with the KafkaTypeVerification step to respect schema modifications:

**Schema Field Priority:**

1. **Schema Fields** (from `topic.schema.fields`): Used if available
2. **Event Data**: Fallback if schema fields not available

**Effective Event Building:**

```typescript
const effectiveEventData = useMemo(() => {
  return buildEffectiveEvent(eventData, schemaFields)
}, [eventData, schemaFields])
```

**Key Points:**

- Uses `buildEffectiveEvent` to apply schema modifications
- Removes fields marked as `isRemoved`
- Adds placeholder values for fields marked as `isManuallyAdded`
- Ensures key selection reflects actual event structure

**Schema Modification Notice:**

- Displays notice when schema has been modified
- Shows count of added and removed fields
- Helps users understand event structure changes

### With Validation Engine

The component integrates with the validation engine for step completion:

**Section Configuration:**

```typescript
validationEngine.onSectionConfigured(StepKeys.DEDUPLICATION_CONFIGURATOR)
```

**Key Points:**

- Marks section as configured when saved
- Integrates with overall pipeline validation flow
- Prevents progression if configuration is incomplete
- Coordinates with other sections for dependency tracking

### With ClickHouse Mapping

The deduplication key is included in the ClickHouse mapping configuration:

**Mapping Integration:**

- Deduplication key is tracked in mapping
- Key is NOT mapped to ClickHouse columns (empty `column_name` and `column_type`)
- Key is used for deduplication logic in pipeline processing
- Mapping is NOT invalidated when deduplication changes (independent concerns)

**Key Points:**

- Deduplication settings (key, time window) are independent of field-to-column mappings
- Only topic/event structure changes should invalidate the mapping
- Deduplication key is preserved in pipeline configuration

### With Core Store

The component integrates with the core store for dirty state tracking:

**Dirty State Management:**

```typescript
if (isEditMode) {
  coreStore.markAsDirty()
  // ...
}
```

**Key Points:**

- Marks pipeline as dirty when changes are made in edit mode
- Ensures changes are sent to backend on pipeline save
- Coordinates with other sections for overall pipeline state

## Utilities

### `buildEffectiveEvent(originalEvent, schemaFields)`

**Location:** `src/utils/common.client.ts`

**Purpose:** Builds an effective event object that reflects schema modifications.

**Process:**

1. Deep clones original event
2. Removes fields marked as `isRemoved`
3. Adds placeholder values for fields marked as `isManuallyAdded`
4. Returns modified event

**Key Points:**

- Preserves original event structure
- Applies schema modifications
- Used for key selection and event preview

### `getSchemaModifications(schemaFields)`

**Location:** `src/utils/common.client.ts`

**Purpose:** Checks if schema has any modifications (added or removed fields).

**Returns:**

```typescript
{
  hasAddedFields: boolean
  hasRemovedFields: boolean
  addedCount: number
  removedCount: number
}
```

**Key Points:**

- Counts added and removed fields
- Used for displaying modification notices
- Helps users understand schema changes

### `getEffectiveFieldNames(schemaFields)`

**Location:** `src/utils/common.client.ts`

**Purpose:** Gets the list of effective field names from schema fields (active, non-removed fields).

**Returns:** `string[]` - Array of active field names

**Key Points:**

- Filters out removed fields
- Returns only active fields
- Used for key selection dropdown

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
- Used as fallback when schema fields not available

## Analytics Integration

The component tracks analytics events via `useJourneyAnalytics`:

**Page View:**

```typescript
analytics.page.deduplicationKey({})
```

- Tracked when component loads
- Indicates user entered deduplication step

**Key Selection:**

```typescript
analytics.key.dedupKey({
  keyType,
  window,
  unit,
})
```

- Tracked when deduplication key is selected
- Includes key type, window, and unit
- Also tracked for skip action (with `keyType: 'skipped'`)

**Key Points:**

- Tracks user interactions for product analytics
- Helps understand user behavior
- Includes relevant context (key type, time window)

## Error Handling

### Missing Topic Data

```typescript
if (!topic) {
  return <div>No topic data available for index {index}</div>
}
```

**Key Points:**

- Displays error if topic data is missing
- Prevents component from crashing
- Provides user-friendly error message

### Missing Event Data

```typescript
if (!effectiveEventData) {
  return (
    <div>
      No event data available for topic "{topic.name}". Please ensure the topic has been configured with event data.
    </div>
  )
}
```

**Key Points:**

- Displays error if event data is missing
- Guides user to configure topic first
- Prevents key selection without event data

### Field Extraction Errors

```typescript
try {
  // Extract fields...
} catch (err) {
  console.error('Error processing event data:', err)
  setError('Error processing event data')
}
```

**Key Points:**

- Handles errors gracefully
- Displays user-friendly error message
- Logs error for debugging

### Time Window Validation Errors

```typescript
if (value > MAX_DAYS) {
  setError(`Maximum time window is ${MAX_DAYS} days`)
  return false
}
```

**Key Points:**

- Validates against maximum time window
- Provides clear error messages
- Prevents invalid values from being set

## User Experience Features

### Schema Modification Awareness

- Displays notice when schema has been modified
- Shows count of added and removed fields
- Helps users understand event structure changes

### Effective Event Display

- Shows event data with schema modifications applied
- Uses `EventEditor` for read-only preview
- Helps users understand actual event structure

### Remounting on Topic Change

```typescript
<SelectDeduplicateKeys
  key={`dedup-keys-${topic.name}-${Date.now()}`}
  // ...
/>
```

**Key Points:**

- Forces remount when topic name changes
- Ensures fresh state for new topic
- Prevents stale data from previous topic

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

### Skip Functionality

- Only available in creation mode
- Not shown in edit mode (standalone)
- Provides alternative path for ingest-only/join-only pipelines

## Best Practices

1. **Key Selection:**
   - Choose a truly unique identifier field (e.g., UUID, transaction ID)
   - Avoid timestamps (not unique)
   - Consider composite keys if no single field is unique

2. **Time Window Configuration:**
   - Set based on expected duplicate arrival window
   - Consider retry delays and network issues
   - Balance memory usage with duplicate detection coverage

3. **Schema Integration:**
   - Always consider schema modifications when selecting keys
   - Use effective event data for key selection
   - Review schema modification notices

4. **Validation:**
   - Ensure key and time window are configured before proceeding
   - Review validation errors before saving
   - Test with sample data before deployment

5. **Edit Mode:**
   - Review existing configuration before making changes
   - Use discard functionality to revert changes
   - Save changes explicitly (don't rely on auto-save)

## Future Improvements

Potential areas for enhancement:

1. **Key Type Support:**
   - Re-enable key type selector
   - Support different key types (string, int, UUID, etc.)
   - Validate key type compatibility

2. **Composite Keys:**
   - Support multiple fields as composite key
   - Combine multiple fields for uniqueness
   - Handle key concatenation logic

3. **Advanced Time Window:**
   - Support custom time window expressions
   - Allow different time windows for different keys
   - Support sliding window configurations

4. **Key Validation:**
   - Validate key uniqueness in sample data
   - Warn about potential duplicate keys
   - Provide key selection recommendations

5. **Performance Optimization:**
   - Debounce field extraction
   - Cache available keys
   - Optimize re-renders

## Related Documentation

- [Kafka Connection Module](../kafka/KAFKA_CONNECTION.md) - Topic and event data source
- [Kafka Type Verification](../kafka/KAFKA_TYPE_VERIFICATION.md) - Schema field information
- [ClickHouse Mapping](../clickhouse/CLICKHOUSE_MAPPING.md) - Destination configuration
- [State Management](../../architecture/ARCHITECTURE_OVERVIEW.md) - Store architecture
- [Validation Engine](../../architecture/ARCHITECTURE_OVERVIEW.md) - Validation flow
