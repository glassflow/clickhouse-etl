# Transformation Configurator Module Documentation

## Overview

The Transformation Configurator module provides a comprehensive interface for defining field transformations that convert Kafka event data into an intermediary schema. This intermediary schema serves as the bridge between Kafka events and ClickHouse destination mapping, enabling users to create computed fields, pass through existing fields, and apply various transformation functions to prepare data for storage.

## Architecture

### Component Hierarchy

```
TransformationConfigurator (Main Orchestrator ~250 lines)
├── Custom Hooks
│   ├── useAvailableFields (field derivation logic)
│   ├── useTransformationValidation (validation state management)
│   └── useTransformationActions (action handlers)
│
├── SchemaModificationNotice (schema change banner)
├── Header with Description
├── Skip Transformation Button
├── NoTransformationView (empty state)
├── TransformationFieldList
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
├── IntermediarySchemaPreview
│   ├── Schema Table
│   │   ├── Field Name Column
│   │   ├── Type Column
│   │   └── Source Column
│   ├── Validation Status Indicator
│   └── Expandable Validation Error Details
│
└── Form Actions
    ├── Save Transformation Button
    ├── Discard Changes Button
    └── Edit Mode Toggle (standalone mode)
```

### File Structure

```
src/modules/transformation/
├── TransformationConfigurator.tsx    # Main orchestrator component (~250 lines)
├── functions.ts                      # Transformation function definitions
├── utils.ts                          # Expression generation & validation utilities
│
├── hooks/
│   ├── useAvailableFields.ts         # Field derivation from multiple sources
│   ├── useTransformationValidation.ts # Validation state management
│   └── useTransformationActions.ts   # All action handlers
│
└── components/
    ├── SchemaModificationNotice.tsx  # Schema change notification banner
    ├── NoTransformationView.tsx      # Empty state view
    ├── TransformationFieldList.tsx   # Field list with controls
    ├── IntermediarySchemaPreview.tsx # Schema preview with validation
    ├── TransformationFieldRow.tsx    # Individual field row (expandable)
    ├── TypeToggle.tsx                # Passthrough/Computed toggle
    ├── SourceFieldSelect.tsx         # Source field selector
    ├── TransformFunctionSelect.tsx   # Function selector with args
    ├── ExpressionModeToggle.tsx      # Simple/Nested/Raw mode toggle
    ├── NestedFunctionComposer.tsx    # Nested function builder
    ├── ConcatExpressionBuilder.tsx   # Concat builder with post-processing
    ├── WaterfallExpressionBuilder.tsx # Waterfall array builder
    ├── RawExpressionEditor.tsx       # Raw expression input
    ├── ArithmeticModifier.tsx        # Arithmetic operations
    ├── FunctionArgumentInput.tsx     # Function argument input
    ├── FunctionSelector.tsx          # Function dropdown
    └── OutputField.tsx               # Output field configuration
```

## Core Components

### 1. TransformationConfigurator

**Location:** `src/modules/transformation/TransformationConfigurator.tsx`

**Purpose:** The main orchestrator component that coordinates the transformation configuration flow. It delegates business logic to custom hooks and renders sub-components.

**Key Responsibilities:**

- Coordinates data flow between hooks and components
- Handles auto-population of fields from Kafka schema
- Manages component-level state (save success, auto-populated flag)
- Renders the overall layout and conditional sections

**Props:**

```typescript
interface TransformationConfiguratorProps {
  onCompleteStep: (stepName: string) => void
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}
```

### 2. Custom Hooks

#### useAvailableFields

**Location:** `src/modules/transformation/hooks/useAvailableFields.ts`

**Purpose:** Derives available fields from multiple sources with priority-based resolution.

**Priority Order:**
1. Schema fields from KafkaTypeVerification (respects added/removed fields)
2. Fields extracted from effective event data
3. Fields from existing transformation configurations (fallback for edit mode)

```typescript
function useAvailableFields(
  schemaFields: SchemaField[] | undefined,
  effectiveEventData: any,
  transformationFields: TransformationField[]
): Array<{ name: string; type: string }>
```

#### useTransformationValidation

**Location:** `src/modules/transformation/hooks/useTransformationValidation.ts`

**Purpose:** Manages validation state and computed validation values.

**Returns:**
- `localValidation` - Current validation state
- `saveAttempted` / `setSaveAttempted` - Track if save was attempted
- `validationErrorDetails` - Structured error details for display
- `totalErrorCount` - Total count of all errors
- `isValidationExpanded` / `setIsValidationExpanded` - Expansion state

```typescript
function useTransformationValidation(
  transformationConfig: TransformationConfig,
  transformationStore?: { setExpressionString: (expr: string) => void }
): UseTransformationValidationReturn
```

#### useTransformationActions

**Location:** `src/modules/transformation/hooks/useTransformationActions.ts`

**Purpose:** Consolidates all action handlers for field management and form actions.

**Returns:**
- `handleAddPassthroughField` - Add passthrough field
- `handleAddComputedField` - Add computed field
- `handleUpdateField` - Update existing field
- `handleRemoveField` - Remove field
- `handleClearAllFields` - Clear all fields
- `handleRestoreSourceFields` - Restore from source
- `handleSkip` - Skip transformation step
- `handleSave` - Save and continue
- `handleDiscardChanges` - Discard all changes

```typescript
function useTransformationActions(
  stores: TransformationActionsStores,
  transformationConfig: TransformationConfig,
  availableFields: AvailableField[],
  options: TransformationActionsOptions,
  validation: TransformationActionsValidation,
  setIsSaveSuccess: (value: boolean) => void,
  setHasAutoPopulated: (value: boolean) => void
): UseTransformationActionsReturn
```

### 3. Sub-Components

#### SchemaModificationNotice

**Location:** `src/modules/transformation/components/SchemaModificationNotice.tsx`

**Purpose:** Displays a notification when schema has been modified in the type verification step.

```typescript
interface SchemaModificationNoticeProps {
  schemaModifications: {
    hasAddedFields: boolean
    hasRemovedFields: boolean
    addedCount: number
    removedCount: number
  }
}
```

#### NoTransformationView

**Location:** `src/modules/transformation/components/NoTransformationView.tsx`

**Purpose:** Displays empty state when no transformations are configured.

```typescript
interface NoTransformationViewProps {
  readOnly: boolean
  hasAvailableFields: boolean
}
```

#### TransformationFieldList

**Location:** `src/modules/transformation/components/TransformationFieldList.tsx`

**Purpose:** Renders the list of transformation fields with header controls and action buttons.

```typescript
interface TransformationFieldListProps {
  fields: TransformationField[]
  availableFields: Array<{ name: string; type: string }>
  fieldErrors: Record<string, FieldValidation['errors']>
  readOnly: boolean
  completeFieldCount: number
  totalFieldCount: number
  onUpdate: (fieldId: string, updates: Partial<TransformationField>) => void
  onRemove: (fieldId: string) => void
  onClearAll: () => void
  onRestoreSourceFields: () => void
  onAddField: () => void
}
```

#### IntermediarySchemaPreview

**Location:** `src/modules/transformation/components/IntermediarySchemaPreview.tsx`

**Purpose:** Shows a preview of the intermediary schema with validation status and expandable error details.

```typescript
interface IntermediarySchemaPreviewProps {
  config: TransformationConfig
  validation: TransformationConfigValidation
  saveAttempted: boolean
  validationErrorDetails: Array<{ fieldName: string; errors: string[] }>
  totalErrorCount: number
  isValidationExpanded: boolean
  onToggleValidationExpanded: () => void
}
```

### 4. TransformationFieldRow

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

**Props:**

```typescript
interface TransformationFieldRowProps {
  field: TransformationField
  availableFields: Array<{ name: string; type: string }>
  onUpdate: (fieldId: string, updates: Partial<TransformationField>) => void
  onRemove: (fieldId: string) => void
  errors?: FieldValidation['errors']
  readOnly?: boolean
  index: number
}
```

### 5. ConcatExpressionBuilder

**Location:** `src/modules/transformation/components/ConcatExpressionBuilder.tsx`

**Purpose:** Provides a visual builder for the `concat()` function with support for post-processing function chains. This allows users to concatenate multiple fields and literal values, then optionally apply additional transformations to the result.

**Key Features:**

- **Slot-Based Interface:** Add up to 10 slots for fields or literal text values
- **Post-Processing Chain:** Apply additional functions to the concat result (e.g., `toUpper`, `trim`)
- **Expression Preview:** Real-time preview of the generated expression
- **Collapsible UI:** Post-processing section is collapsible to reduce visual clutter

**Props:**

```typescript
interface ConcatExpressionBuilderProps {
  slots: ConcatSlot[]
  availableFields: Array<{ name: string; type: string }>
  onSlotsChange: (slots: ConcatSlot[]) => void
  postProcessChain?: PostProcessFunction[]
  onPostProcessChainChange?: (chain: PostProcessFunction[]) => void
  onExpressionChange?: (expression: string) => void
  onSwitchToRegularMode?: () => void
  disabled?: boolean
  error?: string
}
```

**Post-Processing Example:**

Without post-processing:
```
concat(firstName, " ", lastName)
```

With post-processing (toUpper applied):
```
toUpper(concat(firstName, " ", lastName))
```

With multiple post-processing functions:
```
trim(toUpper(concat(firstName, " ", lastName)))
```

**Data Structure:**

```typescript
interface ConcatSlot {
  id: string
  slotType: 'field' | 'literal'
  fieldName?: string      // For field type
  fieldType?: string      // For field type
  literalValue?: string   // For literal type
}

interface PostProcessFunction {
  id: string
  functionName: string
  additionalArgs: FunctionArg[]  // Arguments beyond the piped concat result
}

interface FunctionArgConcatArray {
  type: 'concat_array'
  slots: ConcatSlot[]
  postProcessChain?: PostProcessFunction[]  // Optional chain of wrapping functions
}
```

**UI Layout:**

```
┌─────────────────────────────────────────────────┐
│ Concat Function                        [concat()]│
│ Concatenate multiple values into a single string│
├─────────────────────────────────────────────────┤
│ [1] Field    [firstName        ▼]          [×] │
│ [2] Text     [" "                 ]        [×] │
│ [3] Field    [lastName         ▼]          [×] │
│ [+ Add Value (3/10)]                            │
├─────────────────────────────────────────────────┤
│ ▼ Post-Processing (optional)              [1]  │
│   Apply functions to transform the concat result│
│                                                 │
│   ↓ concat result pipes into                    │
│   [1] [toUpper               ▼]           [×]  │
│   [+ Add Function]                              │
├─────────────────────────────────────────────────┤
│ Expression Preview                              │
│ toUpper(concat(firstName, " ", lastName))      │
└─────────────────────────────────────────────────┘
```

### 6. Transformation Store

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

**TransformationField Interface:**

```typescript
interface TransformationField {
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

```typescript
type FunctionArg =
  | FunctionArgField           // Field reference
  | FunctionArgLiteral         // Literal value (string, number, boolean)
  | FunctionArgArray           // Array of values
  | FunctionArgNestedFunction  // Nested function call
  | FunctionArgWaterfallArray  // Waterfall slots
  | FunctionArgConcatArray     // Concat slots with optional post-processing

// Post-process function for concat - applies to the concat result
interface PostProcessFunction {
  id: string
  functionName: string
  additionalArgs: FunctionArg[]  // Arguments beyond the piped input
}

// Concat-specific array argument
interface FunctionArgConcatArray {
  type: 'concat_array'
  slots: ConcatSlot[]
  postProcessChain?: PostProcessFunction[]  // Optional wrapping functions
}
```

### 7. Transformation Utilities

**Location:** `src/modules/transformation/utils.ts`

**Purpose:** Provides utility functions for expression generation, validation, and schema computation.

**Key Functions:**

1. **Expression Generation:**
   - `toTransformationExpr(config)`: Generate full transformation expression
   - `fieldToExpr(field)`: Generate expression for single field
   - `computedFieldToExpr(field)`: Generate expression for computed field
   - `passthroughFieldToExpr(field)`: Generate expression for passthrough field

2. **Validation:**
   - `validateTransformationConfig(config)`: Validate entire configuration
   - `validateFieldLocally(field)`: Validate single field
   - `validateNestedFunctionArg(arg)`: Validate nested function recursively

3. **Schema Computation:**
   - `getIntermediarySchema(config)`: Get intermediary schema from config
   - `inferOutputType(functionName)`: Infer output type from function

### 8. Transformation Functions

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

## Data Flow

### Pipeline Creation Flow

1. **User selects topic and verifies field types**
   - Fields are extracted and stored in `topicsStore`
   - Schema modifications (add/remove fields) are tracked

2. **User enters transformation step**
   - `useAvailableFields` hook resolves available fields from multiple sources
   - Auto-populates all fields as passthrough (if first time)
   - Displays transformation fields

3. **User configures transformations**
   - Adds/removes/modifies fields via `useTransformationActions`
   - Each change updates `transformationStore`
   - `useTransformationValidation` validates on each change
   - Expression string is generated automatically

4. **User saves transformation**
   - `handleSave` runs validation
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

### Configuration-Level Validation

- At least one field required when enabled
- No duplicate output field names
- All fields must be complete

### Error Display

- Field errors shown inline in field row
- Global errors shown in expandable section
- Errors only shown after save attempt (prevents premature error display)

## Expression Generation

### Passthrough Field Expression

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

**With Arithmetic Modifier:**
```
toInt(fieldName) * 1000000
```

**Concat Function:**
```
concat(firstName, " ", lastName)
```

**Concat with Post-Processing:**
```
toUpper(trim(concat(firstName, " ", lastName)))
```

### Full Transformation Expression

```json
{
  "outputField1": "sourceField1",
  "outputField2": "toInt(sourceField2)",
  "outputField3": "parseQuery(getQueryParam(url, \"params\"))"
}
```

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
- Expandable validation error details

### Compact Field Display
- Collapsed view shows essential information
- Expandable for detailed editing
- Reduces visual clutter

## Future Enhancements

Potential areas for improvement:

1. **TransformationFieldRow Decomposition:** Apply similar refactoring pattern to reduce the 706-line component

2. **Function Library Expansion:** More transformation functions and custom function definitions

3. **Expression Builder:** Visual drag-and-drop expression builder

4. **Field Preview:** Live preview of transformation results with sample data

5. **Bulk Operations:** Bulk field operations, templates, import/export
