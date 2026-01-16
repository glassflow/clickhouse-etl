# ClickHouse Mapping Module Documentation

## Overview

The ClickHouse Mapping module handles the mapping of event schema from Kafka topics (or intermediary schema created by transformations) to ClickHouse table columns. This module provides a comprehensive interface for selecting target databases and tables, configuring batch processing parameters, and mapping event fields to ClickHouse columns with automatic type inference and validation.

## Architecture

### Component Hierarchy

```
ClickhouseMapper (Main Container)
├── DatabaseTableSelectContainer
│   ├── DatabaseSelect
│   └── TableSelect
├── BatchDelaySelector
│   └── TimeUnitSelector
├── FieldColumnMapper
│   ├── SearchableSelect (Single mode)
│   ├── DualSearchableSelect (Join/Dedup mode)
│   └── CacheRefreshButton
└── FormActions (Save/Discard)

Supporting Infrastructure:
├── Hooks
│   ├── useClickhouseDatabases
│   ├── useClickhouseTables
│   ├── useClickhouseTableSchema
│   └── useClickhouseConnection
├── Utilities (utils.ts)
│   ├── inferJsonType
│   ├── findBestMatchingField
│   ├── validateColumnMappings
│   ├── isTypeCompatible
│   ├── generateApiConfig
│   └── buildInternalPipelineConfig
└── Store Integration
    ├── clickhouseDestinationStore
    ├── topicsStore
    ├── transformationStore
    ├── joinStore
    └── deduplicationStore
```

## Core Components

### 1. ClickhouseMapper

**Location:** `src/modules/clickhouse/ClickhouseMapper.tsx`

**Purpose:** The main container component that orchestrates the entire mapping flow. It manages state, coordinates between different sub-components, handles validation, and generates the final pipeline configuration.

**Key Responsibilities:**
- Manages database and table selection state
- Loads and synchronizes ClickHouse table schema
- Handles event field extraction from Kafka topics or intermediary schema
- Coordinates automatic field-to-column mapping
- Validates type compatibility between source and destination
- Generates API configuration for pipeline deployment
- Supports both single-topic and multi-topic (join/dedup) modes
- Integrates with transformation module for intermediary schema support

**Key State Variables:**

```typescript
// Selection state
const [selectedDatabase, setSelectedDatabase] = useState<string>('')
const [selectedTable, setSelectedTable] = useState<string>('')
const [tableSchema, setTableSchema] = useState<TableSchema>({ columns: [] })
const [mappedColumns, setMappedColumns] = useState<TableColumn[]>([])

// Batch configuration
const [maxBatchSize, setMaxBatchSize] = useState(1000)
const [maxDelayTime, setMaxDelayTime] = useState(1)
const [maxDelayTimeUnit, setMaxDelayTimeUnit] = useState('m')

// Event data
const [eventFields, setEventFields] = useState<string[]>([])
const [eventData, setEventData] = useState<any>(null)

// Validation
const [validationIssues, setValidationIssues] = useState({
  unmappedNullableColumns: [],
  unmappedNonNullableColumns: [],
  unmappedDefaultColumns: [],
  extraEventFields: [],
  incompatibleTypeMappings: [],
  missingTypeMappings: [],
})
```

**Mapping Modes:**

The component supports three operation modes based on the number of topics:

1. **Single Mode** (`mode === 'single'`): Maps fields from a single Kafka topic to ClickHouse columns
2. **Join Mode** (`mode === 'join'`): Maps fields from two Kafka topics (primary and secondary) to ClickHouse columns, with source topic tracking
3. **Dedup Mode**: Similar to join mode but with deduplication logic

**Key Functions:**

#### `handleDatabaseSelection(database: string)`
Handles database selection, resets dependent state, and tracks analytics.

```typescript
const handleDatabaseSelection = useCallback((database: string) => {
  setSelectedDatabase(database)
  setSelectedTable('') // Reset table when database changes
  setTableSchema({ columns: [] })
  setMappedColumns([])
  // Track analytics...
}, [dependencies])
```

#### `handleTableSelection(table: string)`
Handles table selection and triggers schema loading.

```typescript
const handleTableSelection = useCallback((table: string) => {
  if (selectedTable === table) return
  setSelectedTable(table)
  setTableSchema({ columns: [] })
  setMappedColumns([])
  // Track analytics...
}, [dependencies])
```

#### `mapEventFieldToColumn(index: number, eventField: string, source?: 'primary' | 'secondary')`
Maps an event field to a ClickHouse column, inferring the appropriate type.

```typescript
const mapEventFieldToColumn = (index: number, eventField: string, source?: 'primary' | 'secondary') => {
  // Check if transformations are enabled
  const isTransformationEnabled = mode === 'single' && 
    transformationStore.transformationConfig.enabled &&
    transformationStore.transformationConfig.fields.length > 0

  let inferredType: string

  if (isTransformationEnabled && eventField) {
    // Use type from intermediary schema
    const intermediarySchema = transformationStore.getIntermediarySchema()
    const schemaField = intermediarySchema.find(field => field.name === eventField)
    inferredType = schemaField?.type || 'string'
  } else {
    // Use verified type from topic schema or infer from event data
    const verifiedType = getVerifiedTypeFromTopic(topicForSchema, eventField)
    inferredType = verifiedType || inferJsonType(getNestedValue(eventData, eventField))
  }

  // Update column mapping...
}
```

#### `performAutoMapping()`
Automatically maps event fields to columns based on name similarity.

```typescript
const performAutoMapping = useCallback(() => {
  // Clear existing mappings
  const updatedColumns = mappedColumns.map(col => ({
    ...col,
    eventField: '',
    jsonType: '',
    sourceTopic: undefined,
  }))

  if (mode === 'single') {
    // Single mode: map from event fields or intermediary schema
    if (isTransformationEnabled) {
      // Use intermediary schema
      const intermediarySchema = transformationStore.getIntermediarySchema()
      // Map fields...
    } else {
      // Use original event fields
      // Map fields...
    }
  } else {
    // Join/dedup mode: prefer primary topic, fallback to secondary
    updatedColumns.forEach((col) => {
      let matchingField = findBestMatchingField(col.name, primaryEventFields)
      let source: 'primary' | 'secondary' = 'primary'
      
      if (!matchingField) {
        matchingField = findBestMatchingField(col.name, secondaryEventFields)
        source = 'secondary'
      }
      // Map field...
    })
  }

  return hasChanges
}, [dependencies])
```

#### `validateMapping(): ValidationResult | null`
Validates the current mapping configuration and returns validation issues.

```typescript
const validateMapping = useCallback((): ValidationResult | null => {
  const issues = validationIssues

  // Priority order:
  // 1. Type compatibility violations (error)
  // 2. Missing type mappings (error)
  // 3. Non-nullable column violations (error)
  // 4. Unmapped DEFAULT columns (warning)
  // 5. Unmapped nullable columns (warning)
  // 6. Extra event fields (warning)

  if (issues.incompatibleTypeMappings.length > 0) {
    return { type: 'error', canProceed: false, ... }
  }
  // ... other validations
  return null
}, [validationIssues, mappedColumns, tableSchema.columns])
```

#### `completeConfigSave()`
Saves the mapping configuration and generates the API config.

```typescript
const completeConfigSave = useCallback(() => {
  // Final validation
  const { invalidMappings, missingTypeMappings } = validateColumnMappings(mappedColumns)
  
  // Generate API config
  const apiConfig = generateApiConfig({
    pipelineId,
    pipelineName,
    clickhouseConnection,
    clickhouseDestination: updatedDestination,
    selectedTopics,
    // ... other params
  })

  // Update store
  setClickhouseDestination(updatedDestination)
  clickhouseDestinationStore.markAsValid()
  setApiConfig(apiConfig)

  // Deploy or navigate...
}, [dependencies])
```

### 2. FieldColumnMapper

**Location:** `src/modules/clickhouse/components/FieldColumnMapper.tsx`

**Purpose:** Provides the UI for mapping event fields to ClickHouse columns. Displays a table with columns for event fields, data types, source topics, and destination columns.

**Key Features:**
- Displays all ClickHouse table columns in a table format
- Allows selection of event fields for each column
- Shows type compatibility status with visual indicators
- Highlights unmapped non-nullable columns (errors)
- Highlights unmapped columns with DEFAULT expressions (warnings)
- Supports both single-topic and multi-topic (join) mapping modes
- Provides auto-mapping functionality
- Shows source topic icons for join/dedup mode

**Props:**

```typescript
interface FieldColumnMapperProps {
  eventFields: string[]
  mappedColumns: ColumnMappingType[]
  updateColumnMapping: (index: number, field: keyof TableColumn, value: any) => void
  mapEventFieldToColumn: (index: number, eventField: string, source?: 'primary' | 'secondary') => void
  primaryEventFields?: string[]
  secondaryEventFields?: string[]
  primaryTopicName?: string
  secondaryTopicName?: string
  isJoinMapping?: boolean
  readOnly?: boolean
  typesReadOnly?: boolean
  unmappedNonNullableColumns?: string[]
  unmappedDefaultColumns?: string[]
  onRefreshTableSchema: () => void
  onAutoMap: () => boolean
  selectedDatabase: string
  selectedTable: string
}
```

**Visual Indicators:**

- **Red border**: Unmapped non-nullable column (error)
- **Orange border**: Unmapped column with DEFAULT expression (warning)
- **Red border on type**: Type incompatibility (error)
- **Topic icons**: Shows which topic a field comes from (join mode only)

### 3. DatabaseTableSelectContainer

**Location:** `src/modules/clickhouse/components/DatabaseTableSelectContainer.tsx`

**Purpose:** Container component that combines database and table selection components in a responsive layout.

**Features:**
- Displays database and table selectors side-by-side on large screens
- Stacks vertically on smaller screens
- Table selector only appears after database is selected
- Provides refresh functionality for both databases and tables

### 4. BatchDelaySelector

**Location:** `src/modules/clickhouse/components/BatchDelaySelector.tsx`

**Purpose:** Allows configuration of batch processing parameters for ClickHouse inserts.

**Configuration Options:**
- **Max Batch Size**: Maximum number of events to batch before inserting
- **Max Delay Time**: Maximum time to wait before inserting a batch
- **Max Delay Time Unit**: Time unit (seconds, minutes, hours, days)

## Mapping Logic

### Single-Topic Mode

In single-topic mode, the component maps fields from one Kafka topic to ClickHouse columns.

**Field Source Priority:**
1. **Intermediary Schema** (if transformations enabled): Uses fields from `transformationStore.getIntermediarySchema()`
2. **Original Event Fields**: Extracts fields from the selected event using `extractEventFields()`

**Type Inference Priority:**
1. **Verified Type**: Type from topic schema (set during type verification step)
2. **Inferred Type**: Type inferred from event data using `inferJsonType()`
3. **Default**: Falls back to `'string'` if type cannot be determined

**Auto-Mapping Logic:**
```typescript
// For each ClickHouse column
updatedColumns.forEach((col) => {
  // Find best matching field by name similarity
  const matchingField = findBestMatchingField(col.name, eventFields)
  if (matchingField) {
    // Use verified type or infer from data
    const verifiedType = getVerifiedTypeFromTopic(selectedTopic, matchingField)
    const jsonType = verifiedType || inferJsonType(getNestedValue(eventData, matchingField))
    
    // Map the field
    updatedColumns[index] = {
      ...col,
      eventField: matchingField,
      jsonType: jsonType,
    }
  }
})
```

### Join/Dedup Mode

In join/dedup mode, the component maps fields from two Kafka topics (primary and secondary) to ClickHouse columns.

**Field Source Priority:**
1. **Primary Topic** (left topic): Preferred source for field mapping
2. **Secondary Topic** (right topic): Fallback if field not found in primary

**Type Inference:**
- Uses verified type from the appropriate topic schema
- Falls back to inferring from event data of the source topic
- Tracks `sourceTopic` in the mapping to identify which topic a field comes from

**Auto-Mapping Logic:**
```typescript
updatedColumns.forEach((col) => {
  // First try primary topic
  let matchingField = findBestMatchingField(col.name, primaryEventFields)
  let source: 'primary' | 'secondary' = 'primary'
  let sourceData = primaryEventData

  // If no match in primary, try secondary
  if (!matchingField) {
    matchingField = findBestMatchingField(col.name, secondaryEventFields)
    source = 'secondary'
    sourceData = secondaryTopic?.selectedEvent?.event
  }

  if (matchingField && sourceData) {
    const sourceTopic = source === 'primary' ? primaryTopic?.name : secondaryTopic?.name
    const topicForSchema = source === 'primary' ? primaryTopic : secondaryTopic

    const verifiedType = getVerifiedTypeFromTopic(topicForSchema, matchingField)
    const jsonType = verifiedType || inferJsonType(getNestedValue(sourceData, matchingField)) || 'string'

    updatedColumns[index] = {
      ...col,
      eventField: matchingField,
      jsonType,
      sourceTopic: sourceTopic,
    }
  }
})
```

### Transformation Integration

When transformations are enabled, the mapping component uses the intermediary schema instead of the original event fields.

**Intermediary Schema:**
- Generated by `transformationStore.getIntermediarySchema()`
- Contains transformed/computed fields with their output names and types
- Includes passthrough fields (original fields passed through)
- Includes computed fields (fields created by transformations)

**Mapping with Transformations:**
```typescript
if (isTransformationEnabled) {
  const intermediarySchema = transformationStore.getIntermediarySchema()
  const transformedFields = intermediarySchema.map(field => field.name)
  const fieldTypeMap = new Map(intermediarySchema.map(field => [field.name, field.type]))

  // Map using transformed field names and types
  updatedColumns.forEach((col) => {
    const matchingField = findBestMatchingField(col.name, transformedFields)
    if (matchingField) {
      const fieldType = fieldTypeMap.get(matchingField) || 'string'
      updatedColumns[index] = {
        ...col,
        eventField: matchingField,
        jsonType: fieldType,
      }
    }
  })
}
```

## Type System

### Type Inference (`inferJsonType`)

The `inferJsonType` function analyzes JavaScript values and infers appropriate JSON/Kafka types.

**Supported Types:**

```typescript
// Numbers
- Integers: int8, int16, int32, int64, uint8, uint16, uint32, uint64
- Floats: float32, float64

// Other types
- boolean → bool
- string → string
- array → array
- object → object
- null → null
- undefined → undefined
```

**Integer Type Selection:**
- Determines signed vs unsigned based on value sign
- Selects appropriate bit width based on value range
- Falls back to string for values outside safe integer range

**Float Type Selection:**
- Uses heuristics to determine if float32 precision is sufficient
- Falls back to float64 for large or precise values

### Type Compatibility (`isTypeCompatible`)

The `isTypeCompatible` function checks if a source type (Kafka/JSON) can be safely mapped to a ClickHouse column type.

**Compatibility Map:**

```typescript
const TYPE_COMPATIBILITY_MAP: Record<string, string[]> = {
  string: ['String', 'FixedString', 'DateTime', 'DateTime64', 'UUID', 'Enum8', 'Enum16', ...],
  int8: ['Int8'],
  int16: ['Int16'],
  int32: ['Int32'],
  int64: ['Int64', 'DateTime', 'DateTime64'],
  float32: ['Float32'],
  float64: ['Float64', 'DateTime', 'DateTime64'],
  bool: ['Bool'],
  // ... more mappings
}
```

**Special Handling:**
- **Nullable Types**: Strips `Nullable()` wrapper and checks inner type
- **Array Types**: Checks if source is array or if inner type is compatible
- **Partial Matching**: Uses `includes()` for flexible matching (e.g., `Nullable(String)` matches `String`)

### Field Matching (`findBestMatchingField`)

The `findBestMatchingField` function finds the best matching event field for a ClickHouse column name.

**Matching Strategy (in order):**
1. **Exact Match**: Normalized comparison (case-insensitive, ignores underscores/dots)
2. **Last Part Match**: Matches the last part of a dot-notation path
3. **Contains Match**: Partial string matching

**Normalization:**
```typescript
const normalize = (str: string) => str.toLowerCase().replace(/[_\.]/g, '')
```

## Validation

### Continuous Validation

The component continuously validates mappings in real-time using a `useEffect` hook that runs whenever:
- Table schema changes
- Mapped columns change
- Event fields change

**Validation Checks:**

1. **Unmapped Columns:**
   - **Non-nullable**: Error (must be mapped)
   - **Nullable**: Warning (can be omitted)
   - **DEFAULT expression**: Warning (will use default value)

2. **Type Compatibility:**
   - Checks all mapped fields for type compatibility
   - Flags incompatible mappings as errors

3. **Missing Types:**
   - Flags mapped fields without type information
   - Usually occurs when field path exists but value is undefined/null

4. **Extra Event Fields:**
   - Identifies event fields that are not mapped to any column
   - Warning only (fields will be dropped during processing)

### Validation on Save

Before saving the configuration, the component runs comprehensive validation:

**Validation Priority:**
1. **Type Incompatibility** (Error): Blocks save
2. **Missing Type Information** (Error): Blocks save
3. **Unmapped Non-nullable Columns** (Error): Blocks save
4. **Unmapped DEFAULT Columns** (Warning): Allows save with confirmation
5. **Unmapped Nullable Columns** (Warning): Allows save with confirmation
6. **Extra Event Fields** (Warning): Allows save with confirmation

**Validation Result:**
```typescript
type ValidationResult = {
  type: 'error' | 'warning' | 'info'
  canProceed: boolean
  message: string
  title: string
  okButtonText: string
  cancelButtonText: string
}
```

## Configuration Generation

### API Config Generation (`generateApiConfig`)

The `generateApiConfig` function creates the final pipeline configuration that will be sent to the backend API.

**Process:**
1. Builds internal pipeline config using `buildInternalPipelineConfig`
2. Gets appropriate version adapter using `getPipelineAdapter`
3. Generates external API config using adapter

**Internal Config Structure:**
```typescript
{
  pipeline_id: string
  name: string
  source: {
    type: 'kafka'
    connection_params: KafkaConnectionParams
    topics: TopicConfig[]
  }
  sink: {
    type: 'clickhouse'
    host: string
    port: string
    database: string
    username: string
    password: string
    secure: boolean
    table: string
    table_mapping: TableMapping[]
    max_batch_size: number
    max_delay_time: string
  }
  join?: JoinConfig
  filter?: FilterConfig
  transformation?: TransformationConfig
}
```

### Table Mapping Generation

The table mapping connects event fields to ClickHouse columns:

```typescript
{
  source_id: string,      // Topic name
  field_name: string,     // Event field path
  column_name: string,     // ClickHouse column name
  column_type: string,     // ClickHouse column type (Nullable wrapper removed)
}
```

**Special Mappings:**
- **Deduplication Keys**: Added to mapping with empty `column_name` and `column_type` (not mapped to ClickHouse but needed for schema)
- **Join Keys**: Added to mapping with empty `column_name` and `column_type`
- **Filter Fields**: Added to mapping with empty `column_name` and `column_type` (for single-topic pipelines only)

## Utilities

### `inferJsonType(value: any): string`
Infers the JSON/Kafka type from a JavaScript value.

### `findBestMatchingField(columnName: string, fields: string[]): string | undefined`
Finds the best matching event field for a column name using fuzzy matching.

### `getNestedValue(obj: any, path: string): any`
Extracts a nested value from an object using dot notation (e.g., `"user.address.city"`).

### `isTypeCompatible(sourceType: string, clickhouseType: string): boolean`
Checks if a source type is compatible with a ClickHouse column type.

### `validateColumnMappings(mappings: any[]): ValidationResult`
Validates all column mappings for type compatibility and completeness.

### `filterUserMappableColumns(columns: TableColumn[]): TableColumn[]`
Filters out ALIAS and MATERIALIZED columns that cannot be mapped by users.

### `hasDefaultExpression(column: TableColumn): boolean`
Checks if a column has a DEFAULT expression.

### `getMappingType(eventField: string, mapping: any[]): string`
Gets the mapped type for an event field from the mapping array.

### `generateApiConfig(...): any`
Generates the final API configuration for pipeline deployment.

### `buildInternalPipelineConfig(...): InternalPipelineConfig`
Builds the internal pipeline configuration structure from UI stores.

## State Management

### Store Integration

The component integrates with multiple Zustand stores:

- **clickhouseDestinationStore**: Stores destination configuration (database, table, mapping, batch settings)
- **topicsStore**: Provides topic data and event information
- **transformationStore**: Provides intermediary schema when transformations are enabled
- **joinStore**: Provides join configuration for multi-topic pipelines
- **deduplicationStore**: Provides deduplication configuration
- **filterStore**: Provides filter configuration
- **coreStore**: Provides pipeline metadata and validation state

### State Synchronization

**Hydration:**
- Component hydrates from store on mount
- Preserves user changes during editing
- Resets when connection changes

**Schema Sync:**
- Table schema is synced from `useClickhouseTableSchema` hook
- Mappings are preserved when schema updates
- Only updates if schema actually changed

**Event Data Sync:**
- Event fields are extracted when event data changes
- Auto-mapping is triggered when both schema and event fields are available
- Transformation intermediary schema takes precedence over original event fields

## Error Handling

### Connection Errors
- Database connection failures are displayed to the user
- Table schema loading errors are shown with retry options
- Connection changes trigger state resets

### Validation Errors
- Type incompatibilities are highlighted in the UI
- Unmapped required columns are marked with red borders
- Validation errors block save until resolved

### Deployment Errors
- Failed deployments show error messages
- Failed configuration can be downloaded for debugging
- User can retry after fixing issues

## Analytics Tracking

The component tracks various analytics events:

- **Page View**: `analytics.page.selectDestination()`
- **Database Selection**: `analytics.destination.databaseSelected()`
- **Table Selection**: `analytics.destination.tableSelected()`
- **Column Display**: `analytics.destination.columnsShowed()`
- **Field Mapping**: `analytics.destination.columnsSelected()`
- **Mapping Completion**: `analytics.destination.mappingCompleted()`

## Best Practices

1. **Always validate before saving**: The component provides comprehensive validation, but users should review warnings
2. **Use auto-mapping as a starting point**: Auto-mapping provides good defaults but may need manual adjustments
3. **Check type compatibility**: Incompatible types will cause runtime errors
4. **Handle nullable columns**: Unmapped nullable columns are safe but may indicate incomplete mapping
5. **Review DEFAULT columns**: Columns with DEFAULT expressions will be auto-populated but should be reviewed
6. **Test with sample data**: Always test the mapping with sample events before deployment

## Related Documentation

- [ClickHouse Connection Module](./CLICKHOUSE_CONNECTION.md) - Connection setup and testing
- [Kafka Connection Module](../kafka/KAFKA_CONNECTION.md) - Kafka topic configuration
- [Transformation Module](../transformation/TRANSFORMATION.md) - Field transformations
- [Join Configuration](../join/JOIN_CONFIGURATION.md) - Multi-topic join setup
- [Architecture Overview](../../architecture/ARCHITECTURE_OVERVIEW.md) - Overall system architecture
