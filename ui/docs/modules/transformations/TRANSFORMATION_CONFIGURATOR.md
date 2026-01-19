# Transformation Configurator Module Documentation

## Overview

The Transformation Configurator module provides a comprehensive interface for defining field transformations that convert Kafka event data into an intermediary schema. This intermediary schema serves as the bridge between Kafka events and ClickHouse destination mapping, enabling users to create computed fields, pass through existing fields, and apply various transformation functions to prepare data for storage.

## Architecture

### Component Hierarchy

```
TransformationConfigurator (Main Container)
├── Schema Modification Notice
├── Header with Description
├── Skip Transformation Button
├── Transformation Fields Section
│   ├── Field List Header
│   │   ├── Field Count Indicator
│   │   ├── Clear All Button
│   │   └── Restore Source Fields Button
│   │
│   ├── TransformationFieldRow (for each field)
│   │   ├── Compact Header Row
│   │   │   ├── Field Index Badge
│   │   │   ├── Output Field Name Input
│   │   │   ├── Output Type Badge
│   │   │   ├── Source Indicator Badge
│   │   │   └── Action Buttons (Edit, Delete)
│   │   │
│   │   ├── Function Expression Display (computed fields, collapsed)
│   │   │
│   │   └── Expanded Section (when editing)
│   │       ├── Output Field Name Input
│   │       ├── Output Type Override Select
│   │       ├── Type Toggle (Passthrough/Computed)
│   │       ├── Expression Mode Toggle (for computed)
│   │       ├── Source Field Select (for passthrough)
│   │       ├── Transform Function Select (for computed)
│   │       └── Action Buttons (Save, Cancel)
│   │
│   └── Add Field Button
│
├── Intermediary Schema Preview
│   ├── Schema Table
│   │   ├── Field Name Column
│   │   ├── Type Column
│   │   └── Source Column
│   └── Validation Status Indicator
│
└── Form Actions
    ├── Save Transformation Button
    ├── Discard Changes Button
    └── Edit Mode Toggle (standalone mode)
```

## Core Components

### 1. TransformationConfigurator

**Location:** `src/modules/transformation/TransformationConfigurator.tsx`

**Purpose:** The main container component that orchestrates the transformation configuration flow. It manages field definitions, validation, expression generation, and coordinates with the transformation store.

**Key Responsibilities:**

- Manages transformation configuration state from the global store
- Handles auto-population of fields from Kafka schema
- Validates transformation configuration
- Generates transformation expressions
- Coordinates field management (add, update, remove)
- Supports both standalone (edit mode) and integrated (pipeline creation) flows
- Displays intermediary schema preview
- Handles schema modifications from type verification step

**Props:**

```typescript
{
  onCompleteStep: (stepName: string) => void
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}
```

**Key State Management:**

- Reads from `transformationStore` for current configuration
- Reads from `topicsStore` for available fields from Kafka events
- Reads from `coreStore` for dirty state tracking
- Updates `transformationStore` with field changes
- Uses `validationEngine` for step validation

**Available Fields Resolution:**
The component uses a priority-based approach to determine available fields:

1. **Schema Fields (Highest Priority):** Fields from KafkaTypeVerification step
   - Respects added/removed fields from type verification
   - Uses `userType` or `type` from schema fields
   - Filters out removed fields (`isRemoved === false`)

2. **Effective Event Data (Second Priority):** Fields extracted from event data
   - Uses `buildEffectiveEvent` to reflect schema modifications
   - Infers types using `inferJsonType` utility
   - Extracts nested field paths

3. **Existing Transformations (Fallback):** Fields from existing transformation config
   - Extracts source fields from passthrough transformations
   - Extracts field references from computed field arguments
   - Used when event data isn't loaded yet (editing mode)

**Auto-Population Logic:**
When entering the transformation step for the first time:

- Automatically populates all available fields as passthrough transformations
- Only runs if:
  - Not already auto-populated in this session
  - Not in read-only mode
  - Not in standalone mode
  - Available fields exist
  - No existing transformation fields configured
  - Transformation not already enabled

**Validation Flow:**

1. **Local Validation:** Performed on every configuration change
   - Validates field completeness
   - Checks for duplicate output field names
   - Validates function arguments
   - Validates nested functions recursively
   - Validates waterfall arrays
   - Validates raw expressions

2. **Error Display:** Errors shown only after save attempt
   - Prevents showing errors while user is still editing
   - Shows field-level errors inline
   - Shows global errors at the bottom

3. **Expression Generation:** Automatically generates expression string
   - Updates on every valid configuration change
   - Used for backend submission
   - Format: `{"fieldName": expression, ...}`

**Schema Modification Notice:**
Displays when fields have been added or removed in the type verification step:

- Shows count of added fields (highlighted in primary color)
- Shows count of removed fields (highlighted in negative color)
- Helps users understand schema changes from previous step

**Intermediary Schema Preview:**
Shows a table preview of the resulting schema:

- Field Name: Output field name in intermediary schema
- Type: Output field type
- Source: Source information (field reference, function name, or raw expression)
- Only displayed when fields are complete and valid

### 2. TransformationFieldRow

**Location:** `src/modules/transformation/components/TransformationFieldRow.tsx`

**Purpose:** Renders a single transformation field with compact and expanded views. Handles field editing, type switching, and function configuration.

**Key Features:**

- Compact header row for quick overview
- Expandable section for detailed editing
- Support for passthrough and computed field types
- Expression mode toggle (simple, nested, raw)
- Function argument configuration
- Output type override
- Validation error display

**Field Types:**

1. **Passthrough Fields:**
   - Direct mapping from source field to output field
   - Simple field selection from available fields
   - Type inferred from source field

2. **Computed Fields:**
   - Apply transformation functions to create new fields
   - Support for multiple expression modes:
     - **Simple Mode:** Single function call with basic arguments
     - **Nested Mode:** Nested function calls and complex arguments
     - **Raw Mode:** Custom expression string (for complex cases)
   - Support for arithmetic modifiers (e.g., `* 1000000`)
   - Output type can be overridden

**Expression Modes:**

1. **Simple Mode:**
   - Single function with field/literal arguments
   - Example: `toInt(field_name)`

2. **Nested Mode:**
   - Nested function calls
   - Complex argument types (arrays, nested functions, waterfall arrays)
   - Example: `parseQuery(getQueryParam(url, "params"))`

3. **Raw Mode:**
   - Custom expression string
   - For complex expressions not supported by function composer
   - Example: `field1 > 0 ? field1 : field2`

**Component States:**

1. **Collapsed State:**
   - Shows field index, output name, type, and source indicator
   - For computed fields, shows function expression below header
   - Quick edit button to expand

2. **Expanded State:**
   - Full editing interface
   - All configuration options visible
   - Save/Cancel buttons
   - Auto-focuses output field name input

**Props:**

```typescript
{
  field: TransformationField
  availableFields: Array<{ name: string; type: string }>
  onUpdate: (fieldId: string, updates: Partial<TransformationField>) => void
  onRemove: (fieldId: string) => void
  errors?: FieldValidation['errors']
  readOnly?: boolean
  index: number
}
```

### 3. Transformation Store

**Location:** `src/store/transformation.store.ts`

**Purpose:** Manages transformation configuration state using Zustand.

**State Structure:**

```typescript
{
  transformationConfig: {
    enabled: boolean
    fields: TransformationField[]
  }
  expressionString: string
  backendValidation: {
    status: 'idle' | 'validating' | 'valid' | 'invalid'
    errors?: string[]
  }
  validation: ValidationState
}
```

**Key Actions:**

1. **Field Management:**
   - `addField(field?)`: Add new field (defaults to passthrough)
   - `addPassthroughField(sourceField, sourceFieldType, outputFieldName?)`: Add passthrough field
   - `addComputedField(functionName, functionArgs, outputFieldName, outputFieldType)`: Add computed field
   - `updateField(fieldId, updates)`: Update field properties
   - `removeField(fieldId)`: Remove field
   - `clearFields()`: Remove all fields
   - `addAllFieldsAsPassthrough(fields)`: Bulk add passthrough fields

2. **Configuration Management:**
   - `setTransformationEnabled(enabled)`: Enable/disable transformations
   - `setExpressionString(expression)`: Set generated expression
   - `getTransformationConfig()`: Get current config
   - `setTransformationConfig(config)`: Set entire config
   - `skipTransformation()`: Skip transformation (disable and clear fields)
   - `resetTransformationStore()`: Reset to initial state

3. **Computed Getters:**
   - `getIntermediarySchema()`: Get intermediary schema from fields
   - `hasFields()`: Check if any fields exist
   - `getFieldCount()`: Get number of fields

**TransformationField Interface:**

```typescript
{
  id: string
  type: 'computed' | 'passthrough'
  outputFieldName: string
  outputFieldType: string
  // For computed fields:
  functionName?: string
  functionArgs?: FunctionArg[]
  expressionMode?: 'simple' | 'nested' | 'raw'
  rawExpression?: string
  arithmeticExpression?: TransformArithmeticExpression
  // For passthrough:
  sourceField?: string
  sourceFieldType?: string
}
```

**FunctionArg Types:**

- `FunctionArgField`: Reference to source field
- `FunctionArgLiteral`: Literal value (string, number, boolean)
- `FunctionArgArray`: Array of values (can contain nested functions)
- `FunctionArgNestedFunction`: Nested function call
- `FunctionArgWaterfallArray`: Waterfall array (try first, fallback to next)

### 4. Transformation Utilities

**Location:** `src/modules/transformation/utils.ts`

**Purpose:** Provides utility functions for expression generation, validation, and schema computation.

**Key Functions:**

1. **Expression Generation:**
   - `toTransformationExpr(config)`: Generate full transformation expression
   - `fieldToExpr(field)`: Generate expression for single field
   - `computedFieldToExpr(field)`: Generate expression for computed field
   - `passthroughFieldToExpr(field)`: Generate expression for passthrough field
   - `formatArgForExpr(arg)`: Format function argument for expression
   - `nestedFunctionToExpr(arg)`: Generate nested function expression
   - `waterfallArrayToExpr(arg)`: Generate waterfall array expression

2. **Validation:**
   - `validateTransformationConfig(config)`: Validate entire configuration
   - `validateFieldLocally(field)`: Validate single field
   - `validateNestedFunctionArg(arg)`: Validate nested function recursively
   - `validateWaterfallArrayArg(arg)`: Validate waterfall array

3. **Schema Computation:**
   - `getIntermediarySchema(config)`: Get intermediary schema from config
   - `inferOutputType(functionName)`: Infer output type from function

4. **Helper Functions:**
   - `isFieldArg(arg)`: Check if argument is field reference
   - `isLiteralArg(arg)`: Check if argument is literal
   - `isArrayArg(arg)`: Check if argument is array
   - `isNestedFunctionArg(arg)`: Check if argument is nested function
   - `createFieldArg(name, type)`: Create field argument
   - `createLiteralArg(value, type)`: Create literal argument

**Expression Format:**
The generated expression follows this format:

```json
{
  "outputField1": "sourceField1",
  "outputField2": "toInt(sourceField2)",
  "outputField3": "parseQuery(getQueryParam(url, \"params\"))",
  "outputField4": "field1 * 1000000"
}
```

### 5. Transformation Functions

**Location:** `src/modules/transformation/functions.ts`

**Purpose:** Defines all available transformation functions that can be used in computed fields.

**Function Categories:**

- **URL:** `parseQuery`, `getQueryParam`, `getNestedParam`, `urlDecode`, `extractPathType`
- **String:** `toLower`, `toUpper`, `trim`, `replace`, `substring`, `split`, `concat`
- **Type Conversion:** `toInt`, `toFloat`, `toString`, `toBool`
- **DateTime:** `parseTimestamp`, `formatDate`, `extractYear`, `extractMonth`
- **Boolean:** `and`, `or`, `not`, `equals`, `greaterThan`
- **Array:** `arrayLength`, `arrayGet`, `arrayContains`, `arrayJoin`
- **Utility:** `coalesce`, `if`, `waterfall`, `jsonPath`

**Function Definition Structure:**

```typescript
{
  name: string
  category: FunctionCategory
  description: string
  args: FunctionArgDef[]
  returnType: string
  example: {
    input: string
    output: string
  }
}
```

**Argument Types:**

- `field`: Reference to source field (with optional type constraints)
- `literal`: Literal value (string, number, boolean)
- `array`: Array of values
- `waterfall_array`: Waterfall array (try first, fallback to next)

### 6. Supporting Components

**TypeToggle:**

- Toggles between passthrough and computed field types
- Located in `components/TypeToggle.tsx`

**SourceFieldSelect:**

- Selects source field for passthrough fields
- Located in `components/SourceFieldSelect.tsx`

**TransformFunctionSelect:**

- Selects transformation function for computed fields
- Handles function argument configuration
- Supports nested functions and waterfall arrays
- Located in `components/TransformFunctionSelect.tsx`

**ExpressionModeToggle:**

- Toggles between simple, nested, and raw expression modes
- Located in `components/ExpressionModeToggle.tsx`

**NestedFunctionComposer:**

- Composes nested function calls
- Located in `components/NestedFunctionComposer.tsx`

**WaterfallExpressionBuilder:**

- Builds waterfall array expressions
- Located in `components/WaterfallExpressionBuilder.tsx`

**RawExpressionEditor:**

- Edits raw expression strings
- Located in `components/RawExpressionEditor.tsx`

**ArithmeticModifier:**

- Adds arithmetic operations to function results
- Located in `components/ArithmeticModifier.tsx`

## Data Flow

### Pipeline Creation Flow

1. **User selects topic and verifies field types**
   - Fields are extracted and stored in `topicsStore`
   - Schema modifications (add/remove fields) are tracked

2. **User enters transformation step**
   - `TransformationConfigurator` reads available fields from `topicsStore`
   - Auto-populates all fields as passthrough (if first time)
   - Displays transformation fields

3. **User configures transformations**
   - Adds/removes/modifies fields
   - Each change updates `transformationStore`
   - Validation runs on each change
   - Expression string is generated automatically

4. **User saves transformation**
   - Validation runs again
   - Expression string is finalized
   - `validationEngine` marks step as configured
   - Step completion callback is triggered

### Pipeline Edit Flow

1. **User opens existing pipeline**
   - Pipeline data is hydrated from API
   - `hydrateTransformation` parses transformation config
   - Reconstructs transformation fields from expression or field definitions

2. **User enters edit mode**
   - `TransformationConfigurator` renders in standalone mode
   - Shows existing transformation fields
   - User can modify fields

3. **User saves changes**
   - Validation runs
   - Expression string is updated
   - `coreStore` is marked as dirty
   - Changes are saved to backend on pipeline save

### Hydration Process

**Location:** `src/store/hydration/transformation.ts`

**Purpose:** Restores transformation state when loading existing pipeline.

**Supported Formats:**

1. **Stateless Transformation (V2 API):**
   - Format: `stateless_transformation.transforms[]`
   - Each transform has: `output_name`, `output_type`, `expression`
   - Parses expressions to reconstruct fields
   - Handles function calls, nested functions, raw expressions

2. **Internal Transformation (Legacy):**
   - Format: `transformation.fields[]`
   - Direct field definitions
   - Backward compatibility

**Hydration Steps:**

1. Check for transformation config in pipeline
2. Parse expression strings to reconstruct fields
3. Handle function calls and nested functions
4. Reconstruct function arguments
5. Set transformation config in store
6. Mark as valid

**Expression Parsing:**

- Parses function calls: `functionName(args)`
- Handles nested functions recursively
- Extracts field references and literals
- Handles arithmetic modifiers
- Falls back to raw expression if parsing fails

## Validation

### Field-Level Validation

**Passthrough Fields:**

- Output field name: Required, valid identifier format
- Source field: Required

**Computed Fields:**

- Output field name: Required, valid identifier format
- Function name: Required (unless raw mode)
- Function arguments: Required based on function definition
- Raw expression: Required if in raw mode
- Nested functions: Validated recursively
- Waterfall arrays: At least 2 slots, all slots valid

### Configuration-Level Validation

- At least one field required when enabled
- No duplicate output field names
- All fields must be complete

### Validation States

1. **Idle:** No validation attempted yet
2. **Validating:** Backend validation in progress
3. **Valid:** Configuration is valid
4. **Invalid:** Configuration has errors

**Error Display:**

- Field errors shown inline in field row
- Global errors shown at bottom of form
- Errors only shown after save attempt (prevents premature error display)

## Expression Generation

### Passthrough Field Expression

Simple field reference:

```
sourceFieldName
```

### Computed Field Expression

**Simple Function:**

```
functionName(fieldArg, "literalArg")
```

**Nested Function:**

```
outerFunction(innerFunction(fieldArg, "literal"), anotherField)
```

**Raw Expression:**

```
field1 > 0 ? field1 : field2
```

**With Arithmetic Modifier:**

```
toInt(fieldName) * 1000000
```

### Full Transformation Expression

JSON object format:

```json
{
  "outputField1": "sourceField1",
  "outputField2": "toInt(sourceField2)",
  "outputField3": "parseQuery(getQueryParam(url, \"params\"))"
}
```

## Intermediary Schema

The intermediary schema is the output of the transformation step and serves as input to the ClickHouse mapping step.

**Schema Structure:**

```typescript
{
  name: string        // Output field name
  type: string        // Output field type
  sourceField?: string        // For passthrough fields
  functionName?: string       // For computed fields (function mode)
  rawExpression?: string      // For computed fields (raw mode)
}
```

**Schema Generation:**

- Only includes complete fields
- Preserves source information for mapping
- Used by ClickHouse mapping step to show available fields

## Integration Points

### With Kafka Type Verification

- Reads schema fields from type verification step
- Respects added/removed fields
- Shows schema modification notice

### With ClickHouse Mapping

- Provides intermediary schema as input
- Field names and types used for mapping
- Schema preview helps users understand transformation output

### With Validation Engine

- Marks step as configured on save
- Integrates with overall pipeline validation
- Prevents progression if invalid

### With Pipeline Actions

- Supports standalone edit mode
- Marks pipeline as dirty on changes
- Handles save/discard actions

## User Experience Features

### Auto-Population

- Automatically adds all available fields as passthrough
- Saves time for common use case
- Only runs once per session

### Restore Source Fields

- Button to restore all source fields as passthrough
- Useful when fields are cleared or modified
- Replaces existing fields

### Skip Transformation

- Option to skip transformation entirely
- All fields pass through unchanged
- Useful for simple pipelines

### Field Count Indicator

- Shows complete/total field count
- Helps users track progress
- Updates in real-time

### Intermediary Schema Preview

- Visual preview of transformation output
- Shows field names, types, and sources
- Helps users understand result before mapping

### Compact Field Display

- Collapsed view shows essential information
- Expandable for detailed editing
- Reduces visual clutter

### Expression Preview

- Shows function expression for computed fields
- Helps users understand transformation
- Truncated for long expressions

## Error Handling

### Validation Errors

- Field-level errors shown inline
- Global errors shown at bottom
- Errors persist until fixed

### Backend Validation

- Expression sent to backend for validation
- Backend errors displayed to user
- Prevents invalid configurations from being saved

### Expression Parsing Errors

- Falls back to raw expression if parsing fails
- Preserves user's original expression
- Allows manual editing

## Performance Considerations

### Expression Generation

- Generated on every configuration change
- Cached in store
- Only regenerated when fields change

### Validation

- Runs on every configuration change
- Errors only displayed after save attempt
- Prevents unnecessary error flashing

### Field Rendering

- Uses React memoization where possible
- Collapsed view reduces DOM nodes
- Expanded view only when editing

## Future Enhancements

Potential areas for improvement:

1. **Function Library Expansion:**
   - More transformation functions
   - Custom function definitions
   - Function composition templates

2. **Expression Builder:**
   - Visual expression builder
   - Drag-and-drop function composition
   - Expression templates

3. **Field Preview:**
   - Live preview of transformation results
   - Sample data transformation
   - Error detection before save

4. **Bulk Operations:**
   - Bulk field operations
   - Field templates
   - Import/export field configurations

5. **Advanced Features:**
   - Conditional transformations
   - Field grouping
   - Transformation versioning
