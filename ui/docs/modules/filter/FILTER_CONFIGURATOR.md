# Filter Configurator Module Documentation

## Overview

The Filter Configurator module provides a comprehensive interface for defining event filtering conditions that determine which Kafka events are processed by the pipeline. It enables users to create complex filter rules using a visual query builder with support for nested groups, arithmetic expressions, and various comparison operators. Events that don't match the filter conditions are excluded from further processing.

## Architecture

### Component Hierarchy

```
FilterConfigurator (Main Container)
├── Description Section
├── No Filter View (when disabled)
├── Hydrated Expression View (read-only for existing filters)
├── Filter Rules Section
│   ├── QueryGroup (Root Group - Recursive)
│   │   ├── Group Header
│   │   │   ├── NOT Toggle
│   │   │   ├── Combinator Select (AND/OR)
│   │   │   ├── Add Rule Button
│   │   │   ├── Add Group Button
│   │   │   └── Delete Group Button (if not root)
│   │   │
│   │   └── Group Children (Rules and Nested Groups)
│   │       ├── QueryRule (for each rule)
│   │       │   ├── Rule Header
│   │       │   │   ├── NOT Toggle
│   │       │   │   ├── Expression Mode Toggle
│   │       │   │   └── Delete Button
│   │       │   │
│   │       │   ├── Simple Mode
│   │       │   │   ├── Field Select
│   │       │   │   ├── Operator Select
│   │       │   │   └── Value Input
│   │       │   │
│   │       │   └── Expression Mode
│   │       │       ├── ArithmeticComposer
│   │       │       │   ├── Mode Toggle (Builder/Manual)
│   │       │       │   ├── Builder Mode UI
│   │       │       │   │   ├── Initial Layout (Left | Operator | Right)
│   │       │       │   │   └── Chained Layout (Current Expression + Next Operation)
│   │       │       │   └── Manual Mode UI (Textarea Input)
│   │       │       ├── Operator Select
│   │       │       └── Value Input
│   │       │
│   │       └── QueryGroup (Nested - Recursive, up to MAX_DEPTH)
│   │
│   └── Generated Expression Preview
│       ├── Expression Textarea (read-only)
│       └── Validation Status Badge
│
└── Form Actions
    ├── Skip Filter Button
    ├── Save Filter Button
    └── Discard Changes Button
```

## Core Components

### 1. FilterConfigurator

**Location:** `src/modules/filter/FilterConfigurator.tsx`

**Purpose:** The main container component that orchestrates the filter configuration flow. It manages filter rules, validation, expression generation, and coordinates with the filter store.

**Key Responsibilities:**
- Manages filter configuration state from the global store
- Handles available fields extraction from Kafka events
- Validates filter configuration (local and backend)
- Generates filter expressions
- Coordinates rule and group management
- Supports both standalone (edit mode) and integrated (pipeline creation) flows
- Displays generated expression preview
- Handles debounced backend validation

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
- Reads from `filterStore` for current configuration
- Reads from `topicsStore` for available fields from Kafka events
- Reads from `coreStore` for dirty state tracking
- Updates `filterStore` with rule/group changes
- Uses `validationEngine` for step validation

**Available Fields Resolution:**
The component extracts available fields using a priority-based approach:

1. **Schema Fields (Highest Priority):** Fields from KafkaTypeVerification step
   - Uses `schema.fields` from topic
   - Includes field names and types

2. **Event Data (Fallback):** Fields extracted from selected event
   - Recursively extracts nested fields
   - Infers types from values (number → int/float64, boolean → bool, etc.)
   - Handles nested objects with dot notation (e.g., `user.name`)

**Validation Flow:**

1. **Local Validation:**
   - Performed on every configuration change
   - Validates rule completeness (field, operator, value)
   - Validates arithmetic expressions recursively
   - Checks for required values based on operator type
   - Only shows errors for "touched" conditions or after save attempt

2. **Backend Validation:**
   - Debounced (500ms) to prevent excessive API calls
   - Validates expression syntax and field references
   - Checks operator compatibility with field types
   - Updates validation status in store

3. **Error Display:**
   - Field-level errors shown inline in rule components
   - Global errors shown at bottom of form
   - Errors only shown after save attempt or when condition is touched

**Debounced Validation:**
- Uses `useEffect` with config key serialization
- Prevents infinite loops by tracking previous config key
- Clears pending timeouts on config changes
- Only validates when config actually changes

**View Modes:**

1. **No Filter View:**
   - Shown when filter is disabled and no expression exists
   - Displays empty state message
   - Only visible in read-only mode

2. **Hydrated Expression View:**
   - Shown when filter has expression but no tree structure (parsing failed)
   - Displays expression in read-only textarea
   - Used for viewing existing filters that couldn't be parsed

3. **Query Builder View:**
   - Active filter configuration interface
   - Shows recursive query groups and rules
   - Displays generated expression preview

### 2. QueryGroup

**Location:** `src/modules/filter/components/QueryGroup.tsx`

**Purpose:** Renders a filter group container that can hold rules and nested groups. Supports recursive nesting up to `MAX_GROUP_DEPTH` (3 levels).

**Key Features:**
- Group-level NOT toggle
- Combinator selection (AND/OR)
- Add rule/group buttons
- Delete group button (not for root)
- Recursive rendering of nested groups
- Combinator labels between items
- Depth tracking to prevent excessive nesting

**Group Structure:**
```typescript
{
  id: string
  type: 'group'
  combinator: 'and' | 'or'
  not?: boolean
  children: (FilterRule | FilterGroup)[]
}
```

**Props:**
```typescript
{
  group: FilterGroup
  availableFields: Array<{ name: string; type: string }>
  onAddRule: (parentGroupId: string) => void
  onAddGroup: (parentGroupId: string) => void
  onUpdateRule: (ruleId: string, updates: Partial<FilterRule>) => void
  onUpdateGroup: (groupId: string, updates: Partial<FilterGroup>) => void
  onRemoveItem: (itemId: string) => void
  onTouched?: (id: string) => void
  conditionErrors: Record<string, RuleValidation['errors']>
  readOnly?: boolean
  depth?: number
  isRoot?: boolean
}
```

**Nesting Depth:**
- Maximum depth: 3 levels (root + 2 sub-levels)
- Prevents UI complexity and performance issues
- "Add Group" button disabled at max depth

**Combinator Display:**
- Shows combinator label (AND/OR) between items
- Positioned absolutely above items
- Helps users understand grouping logic

### 3. QueryRule

**Location:** `src/modules/filter/components/QueryRule.tsx`

**Purpose:** Renders a single filter rule with support for simple field comparison or arithmetic expression comparison.

**Key Features:**
- Rule-level NOT toggle
- Expression mode toggle (simple field vs arithmetic expression)
- Field selection (simple mode)
- Operator selection (type-aware)
- Value input (type-aware, operator-aware)
- Arithmetic expression composer (expression mode)
- Validation error display

**Rule Modes:**

1. **Simple Mode:**
   - Direct field comparison
   - Field selection from available fields
   - Operator filtered by field type
   - Value input based on field type and operator

2. **Expression Mode:**
   - Arithmetic expression on left side
   - Uses `ArithmeticComposer` for expression building
   - Only numeric comparison operators available
   - Value input for numeric comparison

**Value Input Types:**

1. **No Value (Null Checks):**
   - Operators: `isNull`, `isNotNull`
   - Shows "No value needed" message

2. **Array Value (In/Not In):**
   - Operators: `in`, `notIn`
   - Comma-separated values input
   - Parsed and validated as array

3. **Boolean Value:**
   - Field type: `bool`
   - Dropdown with true/false options

4. **Numeric Value:**
   - Field types: `int`, `int64`, `float64`, etc.
   - Text input with numeric parsing

5. **String Value:**
   - Field type: `string`
   - Text input

**Props:**
```typescript
{
  rule: FilterRule
  availableFields: Array<{ name: string; type: string }>
  onChange: (id: string, updates: Partial<FilterRule>) => void
  onRemove: (id: string) => void
  onTouched?: (id: string) => void
  validation?: RuleValidation['errors']
  readOnly?: boolean
  depth?: number
}
```

**FilterRule Interface:**
```typescript
{
  id: string
  type: 'rule'
  field: string
  fieldType: string
  useArithmeticExpression?: boolean
  arithmeticExpression?: ArithmeticExpressionNode
  operator: FilterOperator
  value: string | number | boolean
  not?: boolean
}
```

### 4. ArithmeticComposer

**Location:** `src/modules/filter/components/ArithmeticComposer.tsx`

**Purpose:** Builds arithmetic expressions for use in filter rules (e.g., `price + tax * 0.1`). Supports two editing modes: builder (guided) and manual (text input).

**Key Features:**
- Mode toggle (Builder/Manual)
- Builder mode: Step-by-step expression building
- Manual mode: Direct text input with parsing
- Support for nested expressions
- Operator precedence handling
- Field and literal operand support
- Expression preview in chained mode

**Modes:**

1. **Builder Mode:**
   - Guided step-by-step expression building
   - Two layouts:
     - **Initial Layout:** Left operand | Operator | Right operand (symmetric)
     - **Chained Layout:** Current expression (read-only) + Next operation
   - Add/Remove operand buttons
   - Type toggle for operands (field/literal)

2. **Manual Mode:**
   - Direct text input
   - Parses expression on apply
   - Syntax help display
   - Parse error handling
   - Enter key to apply

**Arithmetic Expression Structure:**
```typescript
{
  id: string
  left: ArithmeticOperand | ArithmeticExpressionNode
  operator: '+' | '-' | '*' | '/' | '%'
  right: ArithmeticOperand | ArithmeticExpressionNode
}
```

**Arithmetic Operand Types:**
- `ArithmeticFieldOperand`: Field reference with type
- `ArithmeticLiteralOperand`: Numeric literal value

**Supported Operators:**
- `+`: Addition
- `-`: Subtraction
- `*`: Multiplication
- `/`: Division
- `%`: Modulo

**Expression Building Flow:**

1. **Initial State:**
   - Left operand (field or literal)
   - Operator selection
   - Right operand (field or literal)

2. **Chaining:**
   - Click "Add Operand" to chain another operation
   - Current expression becomes left side
   - New operator and right operand added
   - Expression preview shown for current expression

3. **Unwrapping:**
   - Click "Remove Operand" to remove last operation
   - Unwraps nested expression if exists
   - Clears expression if no nesting

**Props:**
```typescript
{
  expression: ArithmeticExpressionNode | undefined
  availableFields: Array<{ name: string; type: string }>
  onChange: (expression: ArithmeticExpressionNode) => void
  onClear?: () => void
  disabled?: boolean
  error?: string
}
```

### 5. Filter Store

**Location:** `src/store/filter.store.ts`

**Purpose:** Manages filter configuration state using Zustand.

**State Structure:**
```typescript
{
  filterConfig: {
    enabled: boolean
    root: FilterGroup
  }
  expressionString: string
  backendValidation: {
    status: 'idle' | 'validating' | 'valid' | 'invalid'
    error?: string
  }
  validation: ValidationState
}
```

**Key Actions:**

1. **Rule Management:**
   - `addRule(parentGroupId)`: Add new rule to group
   - `updateRule(ruleId, updates)`: Update rule properties
   - `removeItem(itemId)`: Remove rule or group

2. **Group Management:**
   - `addGroup(parentGroupId)`: Add nested group (with depth check)
   - `updateGroup(groupId, updates)`: Update group properties
   - `removeItem(itemId)`: Remove group

3. **Configuration Management:**
   - `setFilterEnabled(enabled)`: Enable/disable filter
   - `setExpressionString(expression)`: Set generated expression
   - `getFilterConfig()`: Get current config
   - `setFilterConfig(config)`: Set entire config
   - `skipFilter()`: Skip filter (disable and clear)
   - `resetFilterStore()`: Reset to initial state

4. **Legacy Actions (Backward Compatibility):**
   - `setCombinator(combinator)`: Set root combinator
   - `addCondition(condition)`: Add legacy condition
   - `updateCondition(id, condition)`: Update legacy condition
   - `removeCondition(id)`: Remove legacy condition
   - `clearConditions()`: Clear all conditions

**Tree Structure Helpers:**
- `addItemToGroup(group, parentId, item)`: Recursively add item to group
- `updateItemInGroup(group, itemId, updates)`: Recursively update item
- `removeItemFromGroup(group, itemId)`: Recursively remove item
- `findItemInGroup(group, itemId)`: Recursively find item
- `getGroupDepth(group)`: Calculate group depth

**Migration Support:**
- `migrateToTreeStructure(config)`: Migrates legacy flat structure to tree structure
- Maintains backward compatibility with old filter format

### 6. Filter Utilities

**Location:** `src/modules/filter/utils.ts`

**Purpose:** Provides utility functions for expression generation, validation, and type checking.

**Key Functions:**

1. **Expression Generation:**
   - `toExprString(config)`: Generate full filter expression
   - `groupToExpr(group)`: Generate expression for group
   - `ruleToExpr(rule)`: Generate expression for rule
   - `arithmeticExpressionToExpr(expr)`: Generate arithmetic expression
   - `formatValueForExpr(value, type)`: Format value for expression
   - `formatArrayValueForExpr(value, type)`: Format array value

2. **Validation:**
   - `validateFilterConfigLocally(config)`: Validate entire configuration
   - `validateRuleLocally(rule)`: Validate single rule
   - `validateArithmeticExpression(expr)`: Validate arithmetic expression recursively

3. **Type Checking:**
   - `getOperatorsForType(type)`: Get available operators for field type
   - `isNumericType(type)`: Check if type is numeric
   - `isBooleanType(type)`: Check if type is boolean
   - `isStringType(type)`: Check if type is string
   - `isNoValueOperator(operator)`: Check if operator needs no value
   - `isArrayValueOperator(operator)`: Check if operator needs array value

4. **Value Parsing:**
   - `parseValueForType(value, type)`: Parse value based on type
   - `getDefaultValueForType(type)`: Get default value for type

5. **Display Formatting:**
   - `arithmeticExpressionToDisplayString(expr)`: Format expression for display
   - `arithmeticOperandToDisplayString(operand)`: Format operand for display
   - Smart parentheses flattening based on operator precedence

**Filter Operators:**

1. **Comparison Operators:**
   - `eq`: equals (`==`)
   - `neq`: not equals (`!=`)
   - `gt`: greater than (`>`)
   - `gte`: greater than or equals (`>=`)
   - `lt`: less than (`<`)
   - `lte`: less than or equals (`<=`)

2. **Membership Operators:**
   - `in`: in array (`in`)
   - `notIn`: not in array (`not in`)

3. **Null Check Operators:**
   - `isNull`: is null (`== nil`)
   - `isNotNull`: is not null (`!= nil`)

**Operator Type Compatibility:**
- **All Types:** `eq`, `neq`, `in`, `notIn`, `isNull`, `isNotNull`
- **Numeric Types Only:** `gt`, `gte`, `lt`, `lte`

**Expression Format:**
The generated expression follows expr-lang syntax:
```
(field1 == "value" && field2 > 10) || (field3 != nil && field4 in [1, 2, 3])
```

### 7. Expression Parser

**Location:** `src/modules/filter/parser/exprParser.ts`

**Purpose:** Parses filter expressions from backend format into tree structure for editing.

**Key Functions:**
- `parseExprToFilterTree(expression)`: Parse expression to filter tree
- Handles operator precedence
- Supports parentheses grouping
- Handles NOT operators
- Reconstructs nested groups

**Parse Result:**
```typescript
{
  success: boolean
  filterGroup?: FilterGroup
  error?: string
  unsupportedFeatures?: string[]
}
```

**Supported Features:**
- Basic comparison operators
- Logical operators (AND, OR)
- NOT operators
- Parentheses grouping
- Nested groups

**Unsupported Features:**
- Complex expressions that can't be represented in tree structure
- Custom functions (reserved for future)

### 8. Arithmetic Expression Parser

**Location:** `src/modules/filter/parser/arithmeticParser.ts`

**Purpose:** Parses arithmetic expressions from text input into expression tree.

**Key Functions:**
- `parseArithmeticExpression(input, availableFields)`: Parse text to expression
- Handles operator precedence
- Validates field references
- Supports parentheses

**Parse Result:**
```typescript
{
  success: boolean
  expression?: ArithmeticExpressionNode
  error?: string
}
```

## Data Flow

### Pipeline Creation Flow

1. **User selects topic and verifies field types**
   - Fields are extracted and stored in `topicsStore`
   - Schema fields available for filter configuration

2. **User enters filter step**
   - `FilterConfigurator` reads available fields from `topicsStore`
   - Displays empty filter builder (root group with no rules)

3. **User configures filter rules**
   - Adds rules to groups
   - Configures field, operator, and value
   - Optionally uses arithmetic expressions
   - Creates nested groups for complex logic
   - Each change updates `filterStore`
   - Local validation runs on each change
   - Backend validation runs after debounce

4. **User saves filter**
   - Validation runs again
   - Expression string is finalized
   - `validationEngine` marks step as configured
   - Step completion callback is triggered

### Pipeline Edit Flow

1. **User opens existing pipeline**
   - Pipeline data is hydrated from API
   - `hydrateFilter` parses filter expression
   - Attempts to reconstruct tree structure
   - Falls back to read-only expression view if parsing fails

2. **User enters edit mode**
   - `FilterConfigurator` renders in standalone mode
   - Shows existing filter tree (if parsed) or expression (if not)
   - User can modify rules and groups

3. **User saves changes**
   - Validation runs
   - Expression string is updated
   - `coreStore` is marked as dirty
   - Changes are saved to backend on pipeline save

### Hydration Process

**Location:** `src/store/hydration/filter.ts`

**Purpose:** Restores filter state when loading existing pipeline.

**Hydration Steps:**

1. Check for filter config in pipeline
2. Set filter enabled state
3. If filter has expression:
   - Set expression string
   - Mark backend validation as valid
   - Attempt to parse expression to tree structure
   - If parsing succeeds: Set filter config with tree
   - If parsing fails: Keep expression string for read-only display
4. If no expression: Reset filter store

**Expression Parsing:**
- Uses `parseExprToFilterTree` to reconstruct tree
- Handles operator precedence and grouping
- Logs unsupported features for debugging
- Falls back gracefully if parsing fails

## Validation

### Rule-Level Validation

**Simple Mode:**
- Field: Required
- Operator: Required
- Value: Required (unless null check operator)
- Type compatibility: Operator must support field type

**Expression Mode:**
- Arithmetic expression: Must be valid and complete
- Operator: Required (numeric comparison only)
- Value: Required (unless null check operator)

**Arithmetic Expression Validation:**
- Left operand: Must be field or valid expression
- Right operand: Must be field or valid expression
- Operator: Required
- Recursive validation for nested expressions

### Configuration-Level Validation

- At least one rule required when enabled
- All rules must be complete
- All groups must have at least one child
- Arithmetic expressions must be valid

### Backend Validation

- Expression syntax validation
- Field reference validation
- Operator compatibility validation
- Type checking for values
- Returns detailed error messages

**Validation States:**
1. **Idle:** No validation attempted yet
2. **Validating:** Backend validation in progress
3. **Valid:** Configuration is valid
4. **Invalid:** Configuration has errors

**Error Display:**
- Rule errors shown inline in rule component
- Global errors shown at bottom of form
- Errors only shown after save attempt or when condition is touched

## Expression Generation

### Rule Expression

**Simple Field:**
```
fieldName == "value"
```

**With NOT:**
```
!(fieldName == "value")
```

**Arithmetic Expression:**
```
(price + tax) > 100
```

**Array Value:**
```
fieldName in [1, 2, 3]
```

**Null Check:**
```
fieldName == nil
```

### Group Expression

**AND Group:**
```
(rule1 && rule2 && rule3)
```

**OR Group:**
```
(rule1 || rule2 || rule3)
```

**With NOT:**
```
!(rule1 && rule2)
```

### Full Filter Expression

Combines all groups and rules with proper parentheses:
```
((field1 == "value" && field2 > 10) || (field3 != nil && field4 in [1, 2, 3]))
```

## Integration Points

### With Kafka Type Verification

- Reads schema fields from type verification step
- Uses field types for operator filtering
- Validates field references

### With Pipeline Actions

- Supports standalone edit mode
- Marks pipeline as dirty on changes
- Handles save/discard actions

### With Validation Engine

- Marks step as configured on save
- Integrates with overall pipeline validation
- Prevents progression if invalid

## User Experience Features

### Debounced Validation

- Prevents excessive API calls
- 500ms debounce delay
- Only validates when config actually changes

### Touched State Tracking

- Only shows errors for conditions user has interacted with
- Prevents premature error display
- Improves user experience

### Expression Preview

- Shows generated expression in real-time
- Helps users understand filter logic
- Read-only textarea display

### Nested Grouping

- Supports up to 3 levels of nesting
- Visual indentation for nested groups
- Combinator labels between items
- Clear hierarchy visualization

### Arithmetic Expression Builder

- Guided step-by-step building
- Manual mode for advanced users
- Expression preview in chained mode
- Smart parentheses flattening

### Type-Aware UI

- Operators filtered by field type
- Value input adapts to field type
- Boolean fields show dropdown
- Array operators show comma-separated input

## Error Handling

### Validation Errors

- Field-level errors shown inline
- Global errors shown at bottom
- Errors persist until fixed
- Context-aware error messages

### Backend Validation

- Expression sent to backend for validation
- Backend errors displayed to user
- Prevents invalid configurations from being saved
- Detailed error messages

### Expression Parsing Errors

- Falls back to read-only expression view
- Preserves user's original expression
- Allows manual editing in query builder
- Logs parsing errors for debugging

## Performance Considerations

### Expression Generation

- Generated on every configuration change
- Cached in store
- Only regenerated when tree changes

### Validation

- Local validation runs on every change
- Backend validation debounced (500ms)
- Errors only displayed after save attempt or when touched
- Prevents unnecessary error flashing

### Tree Rendering

- Recursive rendering of nested groups
- Depth limit prevents excessive nesting
- Efficient tree traversal for updates

## Future Enhancements

Potential areas for improvement:

1. **Additional Operators:**
   - String operators (contains, startsWith, endsWith)
   - Date/time operators
   - Regex matching

2. **Expression Builder:**
   - Visual expression builder
   - Drag-and-drop rule composition
   - Expression templates

3. **Rule Preview:**
   - Live preview of filter results
   - Sample data filtering
   - Error detection before save

4. **Bulk Operations:**
   - Bulk rule operations
   - Rule templates
   - Import/export filter configurations

5. **Advanced Features:**
   - Custom functions in expressions
   - Variable references
   - Filter versioning
