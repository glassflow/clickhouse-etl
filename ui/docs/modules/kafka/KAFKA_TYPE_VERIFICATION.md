# Kafka Type Verification Module Documentation

## Overview

The Kafka Type Verification module allows users to review, verify, and customize the schema of Kafka events. It automatically infers data types from event data, allows users to override inferred types, add custom fields, and remove unwanted fields. The verified schema is stored in the topic's schema and used by downstream steps (transformations, field mapping) to ensure type safety and correct data handling.

**Related:** Kafka connection and topic selection were refactored. This module was refactored to use `useTypeVerificationState`, `FieldTypesTable`, and shared `getNestedValue` from clickhouse/utils. See [KAFKA_CONNECTION.md](./KAFKA_CONNECTION.md) and [KAFKA_TOPIC_SELECTION.md](./KAFKA_TOPIC_SELECTION.md) for up-to-date structure.

## Architecture

### Component Hierarchy

```
KafkaTypeVerification (Orchestration + FormActions)
├── useTypeVerificationState (Hook - field/schema state)
│   ├── extractEventFields (common.client)
│   ├── inferJsonType, getNestedValue (clickhouse/utils)
│   └── field CRUD: handleTypeChange, handleAddField, handleRemoveField, handleRestoreField
│
├── FieldTypesTable (Presentation - table + add-field row + status messages)
│   └── No store access; receives fieldTypes and handlers via props
│
├── TopicsStore (schema storage via updateTopic)
├── ValidationEngine (onSectionConfigured)
└── FormActions (Save/Discard)
```

## Core Components

### KafkaTypeVerification

**Location:** `src/modules/kafka/KafkaTypeVerification.tsx`

**Purpose:** Orchestration component that gets topic/eventData from store, uses `useTypeVerificationState` for field state and handlers, renders `FieldTypesTable`, and handles save/discard and FormActions.

**Key Responsibilities:**

- Gets topic and eventData from topicsStore
- Uses useTypeVerificationState for fieldTypes, new-field form state, and CRUD handlers
- Renders FieldTypesTable (presentational) with fieldTypes and handlers
- Persists schema to topic store on save; integrates with validation engine

**Props:** `KafkaTypeVerificationProps`: `onCompleteStep`, `index?`, `readOnly?`, `standalone?`, `toggleEditMode?`, `pipelineActionState?: PipelineActionState`, `onCompleteStandaloneEditing?`.

### useTypeVerificationState

**Location:** `src/modules/kafka/hooks/useTypeVerificationState.ts`

**Purpose:** Encapsulates field/schema state: builds fieldTypes from eventData + existing schema (extractEventFields, inferJsonType, getNestedValue from clickhouse/utils), and handlers for type change, add field, remove field, restore field. Exposes `canContinue` (activeFieldCount > 0).

**Inputs:** `eventData`, `topic` (with optional schema).

**Outputs:** `fieldTypes`, `newFieldName`, `newFieldType`, `newFieldError`, setters, `handleTypeChange`, `handleAddField`, `handleRemoveField`, `handleRestoreField`, `canContinue`.

### FieldTypesTable

**Location:** `src/modules/kafka/components/FieldTypesTable.tsx`

**Purpose:** Presentational component that renders the field types table (header, body, add-field row, status messages). No store or topic access; receives all data and handlers via props.

## Field Type Management

### FieldTypeInfo Interface

**Location:** `src/modules/kafka/types.ts`

Each field in the table is represented by a `FieldTypeInfo` object:

```typescript
interface FieldTypeInfo {
  name: string // Field name (supports dot notation for nested fields)
  inferredType: string
  userType: string // User-selected type (or inferred if not changed)
  isManuallyAdded: boolean
  isRemoved: boolean
}
```

### Field Categories

1. **Inferred Fields:**
   - Automatically extracted from event data
   - Types are inferred from actual values
   - Can be modified or removed

2. **Manually Added Fields:**
   - Created by user (not present in event data)
   - No inferred type (shown as `-`)
   - User must specify type
   - Can be completely removed (not just marked)

3. **Removed Fields:**
   - Fields marked for removal (but preserved in schema)
   - Shown with strikethrough and reduced opacity
   - Can be restored
   - Filtered out in downstream steps

## Field Extraction

### extractEventFields Function

**Location:** `src/utils/common.client.ts`

**Purpose:** Recursively extracts all fields from event data, including nested objects.

**Algorithm:**

1. Iterates through all keys in the object
2. Skips keys starting with `_metadata`
3. For nested objects: Recursively extracts with dot notation prefix
4. For arrays: Adds the array field itself (not individual elements)
5. For primitives: Adds the field path

**Example:**

```javascript
// Input event:
{
  "id": 1,
  "user": {
    "name": "John",
    "address": {
      "city": "NYC"
    }
  },
  "tags": ["tag1", "tag2"]
}

// Extracted fields:
[
  "id",
  "user.name",
  "user.address.city",
  "tags"
]
```

**Features:**

- Supports unlimited nesting levels
- Uses dot notation for nested paths
- Handles arrays as single fields
- Skips metadata fields

## Type Inference

### inferJsonType Function

**Location:** `src/modules/clickhouse/utils.ts`

**Purpose:** Infers the most appropriate data type from a JSON value.

**Type Inference Rules:**

#### Numbers

- **Integers:**
  - Unsigned: `uint8`, `uint16`, `uint32`, `uint64` (based on value range)
  - Signed: `int8`, `int16`, `int32`, `int64` (based on value range)
  - Falls back to `string` for values outside safe integer range
- **Floating Point:**
  - `float32` for values in range (1.2e-38 to 3.4e38)
  - `float64` for values outside float32 range

#### Other Types

- **Boolean:** `bool`
- **String:** `string` (with pattern detection for UUIDs and dates)
- **Array:** `array`
- **Object:** `object`
- **Null/Undefined:** `null` / `undefined`

**Type Ranges:**

```typescript
// Unsigned integers
uint8:  0 to 255
uint16: 0 to 65,535
uint32: 0 to 4,294,967,295
uint64: 0 to Number.MAX_SAFE_INTEGER

// Signed integers
int8:  -128 to 127
int16: -32,768 to 32,767
int32: -2,147,483,648 to 2,147,483,647
int64: Number.MIN_SAFE_INTEGER to Number.MAX_SAFE_INTEGER
```

## Available Data Types

### JSON_DATA_TYPES

**Location:** `src/config/constants.ts`

**Available Types:**

```typescript
;[
  'string',
  'bool',
  'uint',
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'int',
  'int8',
  'int16',
  'int32',
  'int64',
  'float',
  'float32',
  'float64',
  'bytes',
  'array',
]
```

**Usage:**

- All types are available in the type selector dropdown
- Users can override inferred types with any of these types
- Types are used for downstream processing (transformations, mapping)

## Schema Initialization

### Schema Loading Flow

1. **Event Data Available:**
   - Component receives event data from `topicsStore.getTopic(index).selectedEvent.event`
   - If no event data, shows error message

2. **Existing Schema Check:**
   - Checks if topic already has a schema (from hydration or previous session)
   - Creates a map of existing fields for quick lookup

3. **Field Extraction:**
   - Extracts all fields from event using `extractEventFields()`
   - For each field:
     - Gets nested value using `getNestedValue()`
     - Infers type using `inferJsonType()`
     - Checks existing schema for user overrides
     - Preserves removal state if field was previously removed

4. **Manual Fields:**
   - Adds manually added fields from existing schema
   - These fields may not be present in current event data
   - Preserves their type and removal state

5. **State Update:**
   - Sets `fieldTypes` state with all fields
   - Component re-renders with field table

## Field Operations

### Type Change

**Function:** `handleTypeChange(fieldName: string, newType: string)`

**Behavior:**

- Updates `userType` for the specified field
- Visual indicator shows when type differs from inferred type (border highlight)
- Change is stored in local state until save

### Add Field

**Function:** `handleAddField()`

**Validation:**

- Field name cannot be empty
- Field name must be unique (case-sensitive, among non-removed fields)
- Field name must match pattern: `^[a-zA-Z_][a-zA-Z0-9_.]*$`
  - Must start with letter or underscore
  - Can contain letters, numbers, underscores, dots
  - Supports dot notation for nested paths

**Behavior:**

- Creates new `FieldTypeInfo` with:
  - `isManuallyAdded: true`
  - `inferredType: '-'`
  - `userType: selectedType` (default: 'string')
  - `isRemoved: false`
- Adds to `fieldTypes` array
- Resets input fields

### Remove Field

**Function:** `handleRemoveField(fieldName: string)`

**Behavior:**

- **Manually Added Fields:** Completely removed from array
- **Inferred Fields:** Marked as `isRemoved: true` (preserved in schema)
- Field is visually indicated (strikethrough, reduced opacity)
- Field is filtered out in downstream steps

### Restore Field

**Function:** `handleRestoreField(fieldName: string)`

**Behavior:**

- Sets `isRemoved: false` for the field
- Field becomes active again
- Visual indicators are removed

## Schema Persistence

### Schema Structure

The schema is stored in the topic object:

```typescript
{
  schema: {
    fields: [
      {
        name: string
        type: string              // User-selected type (same as userType)
        inferredType?: string    // Originally inferred type
        userType?: string         // Explicitly set by user
        isManuallyAdded?: boolean // true for user-added fields
        isRemoved?: boolean       // true for removed fields
      }
    ]
  }
}
```

### Save Operation

**Function:** `handleSave()`

**Process:**

1. Validates that topic exists
2. Creates schema object with all fields (including removed ones)
3. Updates topic in `topicsStore` with schema
4. Marks section as configured via `validationEngine.onSectionConfigured()`
5. In standalone mode:
   - Marks config as dirty
   - Sets success state
   - Closes modal
6. In creation mode:
   - Proceeds to next step

**Important:**

- **All fields are saved**, including removed ones
- This preserves removal state when user navigates back
- Downstream steps filter out removed fields
- Schema is the source of truth for field types

## Nested Field Support

### Dot Notation

The module fully supports nested fields using dot notation:

**Example Event:**

```json
{
  "id": 1,
  "user": {
    "profile": {
      "name": "John",
      "age": 30
    }
  }
}
```

**Extracted Fields:**

- `id`
- `user.profile.name`
- `user.profile.age`

### getNestedValue Function

**Location:** `src/modules/clickhouse/utils.ts` (shared; used by useTypeVerificationState and other modules)

**Purpose:** Retrieves values from nested objects using dot notation paths. Single source of truth; Kafka type verification no longer defines a local copy.

**Usage:** Used in `useTypeVerificationState` to get actual values for type inference. Handles missing nested properties gracefully; returns `undefined` if path doesn't exist.

## Visual Indicators

### Field Status Indicators

1. **Type Modified:**
   - Border highlight when `userType !== inferredType`
   - Indicates user has overridden inferred type

2. **Manually Added:**
   - "Added" badge next to field name
   - Background color: `var(--color-background-primary-faded)`

3. **Removed:**
   - Strikethrough text
   - Reduced opacity (50%)
   - "Restore" button instead of "Remove"

4. **Inferred:**
   - Normal background: `var(--surface-bg-sunken)`
   - No special indicators

### Status Messages

Component shows summary messages:

- "Some types have been modified from their inferred values"
- "X custom field(s) added"
- "X field(s) marked for removal"

## Validation

### Continue Button State

**Condition:** `canContinue = activeFieldCount > 0`

- Must have at least one active (non-removed) field
- Prevents saving empty schemas
- Disables submit button if condition not met

### Field Name Validation

**Rules:**

1. Cannot be empty
2. Must be unique (case-sensitive)
3. Must match pattern: `^[a-zA-Z_][a-zA-Z0-9_.]*$`
4. Can use dot notation for nested paths

**Error Messages:**

- "Field name cannot be empty"
- "A field with this name already exists"
- "Field name must start with a letter or underscore and contain only letters, numbers, underscores, or dots"

## Integration with Downstream Steps

### Transformation Step

**Usage:**

- Uses schema fields as available fields
- Filters out removed fields (`!f.isRemoved`)
- Uses `userType` or `type` for field type information
- Falls back to event data extraction if schema not available

### Field Mapping Step

**Usage:**

- Uses verified types from schema for type compatibility checks
- Provides type information for ClickHouse column mapping
- Ensures type safety in mappings

### Schema Priority

1. **Schema fields** (from KafkaTypeVerification) - highest priority
2. **Event data extraction** - fallback if no schema
3. **Existing transformations** - last resort

## State Management

### TopicsStore Integration

**Schema Storage:**

- Schema is stored in `topic.schema`
- Updated via `topicsStore.updateTopic()`
- Persisted across navigation
- Hydrated from backend on edit mode

### Validation Engine

**Section Validation:**

- Uses `validationEngine.onSectionConfigured(StepKeys.KAFKA_TYPE_VERIFICATION)`
- Marks section as valid when saved
- Integrates with overall pipeline validation

### Core Store

**Dirty Tracking:**

- In standalone mode, calls `coreStore.markAsDirty()`
- Indicates unsaved changes
- Triggers download warning

## Error Handling

### Missing Topic Data

**Condition:** `!topic`

**Message:** "No topic data available. Please select a topic first."

**Resolution:** User must go back to topic selection step

### Missing Event Data

**Condition:** `!eventData`

**Message:** "No event data available for topic "{topic.name}". Please ensure the topic has events."

**Resolution:** User must select a topic with events or change offset

### Field Name Validation Errors

**Display:** Inline error message below input field

**Behavior:** Prevents adding field until error is resolved

## User Flow

### Standard Flow (Pipeline Creation)

1. **Initialization:**
   - Component receives event data from topic selection
   - Fields are extracted and types inferred
   - Table is populated with all fields

2. **Review & Customize:**
   - User reviews inferred types
   - User can modify types via dropdown
   - User can add custom fields
   - User can remove unwanted fields

3. **Save:**
   - User clicks "Confirm Types"
   - Schema is saved to topic store
   - Section is marked as configured
   - Proceeds to next step

### Edit Mode Flow (Standalone)

1. **Initialization:**
   - Component loads with existing schema from store
   - Fields are restored with their types and removal states
   - Event data is used to infer types for new fields

2. **Modifications:**
   - User can modify types
   - User can add/remove fields
   - Changes are tracked in local state

3. **Save:**
   - User clicks "Save"
   - Schema is updated in store
   - Config is marked as dirty
   - Modal/form is closed

## Best Practices

1. **Schema Preservation:**
   - Always preserve removed fields in schema
   - This allows users to restore fields later
   - Downstream steps filter them out automatically

2. **Type Inference:**
   - Use actual values for type inference
   - Handle edge cases (null, undefined, large numbers)
   - Provide sensible defaults

3. **Field Validation:**
   - Validate field names before adding
   - Prevent duplicate fields
   - Support dot notation for nested paths

4. **User Experience:**
   - Show clear visual indicators for field status
   - Provide helpful error messages
   - Allow easy restoration of removed fields

5. **Integration:**
   - Always check for existing schema before inferring
   - Preserve user overrides when re-initializing
   - Filter removed fields in downstream steps

## Dependencies

### Internal Dependencies

- `@/src/store` - State management (topicsStore, coreStore)
- `@/src/utils` - Utilities (extractEventFields, getNestedValue)
- `@/src/modules/clickhouse/utils` - Type inference (inferJsonType)
- `@/src/config` - Constants (JSON_DATA_TYPES, StepKeys)
- `@/src/components/ui` - UI components (Table, Select, Input, Button)
- `@/src/components/shared` - Shared components (FormActions)

### External Dependencies

- `react` - React hooks and components
- `@heroicons/react` - Icons (TrashIcon, PlusIcon)

## Technical Debt Addressed (Topic/Type Refactor)

- **getNestedValue:** Removed local reimplementation; `useTypeVerificationState` imports from `@/src/modules/clickhouse/utils` (single source of truth).
- **useTypeVerificationState:** Field/schema state, schema init from eventData + existing schema, and CRUD handlers moved into a dedicated hook. KafkaTypeVerification orchestrates and renders only.
- **FieldTypesTable:** Table UI (header, body, add-field row, status messages) extracted into a presentational component. No store or topic access.
- **FieldTypeInfo:** Moved to `src/modules/kafka/types.ts` and shared.
- **KafkaTypeVerificationProps:** `pipelineActionState` typed as `PipelineActionState` (aligned with TopicSelectorProps).

## Future Improvements

1. **Type Validation:**
   - Validate types against actual values
   - Warn about type mismatches
   - Suggest better types based on data

2. **Bulk Operations:**
   - Select multiple fields for bulk type change
   - Bulk remove/restore operations
   - Import/export schema

3. **Advanced Features:**
   - Field descriptions/comments
   - Default values
   - Required/optional markers
   - Type constraints

4. **Performance:**
   - Optimize for large schemas
   - Virtual scrolling for many fields
   - Debounced type inference

5. **User Experience:**
   - Search/filter fields
   - Sort fields by name/type
   - Group fields by category
   - Schema templates
