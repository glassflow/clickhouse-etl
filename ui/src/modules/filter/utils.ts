import {
  FilterCondition,
  FilterConfig,
  FilterOperator,
  FilterRule,
  FilterGroup,
  ArithmeticExpressionNode,
  ArithmeticOperand,
  ArithmeticOperator,
  isArithmeticExpressionNode,
} from '@/src/store/filter.store'

// Operator definitions with display labels and type compatibility
export interface OperatorDefinition {
  value: FilterOperator
  label: string
  exprSymbol: string
  supportedTypes: string[] // Field types that support this operator
}

// All supported field types for operators (simplified to basic types)
const ALL_TYPES = ['string', 'int', 'uint', 'float', 'bool']

const NUMERIC_TYPES = ['int', 'uint', 'float']

export const FILTER_OPERATORS: OperatorDefinition[] = [
  {
    value: 'eq',
    label: 'equals',
    exprSymbol: '==',
    supportedTypes: ALL_TYPES,
  },
  {
    value: 'neq',
    label: 'not equals',
    exprSymbol: '!=',
    supportedTypes: ALL_TYPES,
  },
  {
    value: 'gt',
    label: 'greater than',
    exprSymbol: '>',
    supportedTypes: NUMERIC_TYPES,
  },
  {
    value: 'gte',
    label: 'greater than or equals',
    exprSymbol: '>=',
    supportedTypes: NUMERIC_TYPES,
  },
  {
    value: 'lt',
    label: 'less than',
    exprSymbol: '<',
    supportedTypes: NUMERIC_TYPES,
  },
  {
    value: 'lte',
    label: 'less than or equals',
    exprSymbol: '<=',
    supportedTypes: NUMERIC_TYPES,
  },
  {
    value: 'in',
    label: 'in',
    exprSymbol: 'in',
    supportedTypes: ALL_TYPES,
  },
  {
    value: 'notIn',
    label: 'not in',
    exprSymbol: 'not in',
    supportedTypes: ALL_TYPES,
  },
  {
    value: 'isNull',
    label: 'is null',
    exprSymbol: '== nil',
    supportedTypes: ALL_TYPES,
  },
  {
    value: 'isNotNull',
    label: 'is not null',
    exprSymbol: '!= nil',
    supportedTypes: ALL_TYPES,
  },
  // DISABLED: Reserved for future stateless transformations
  // {
  //   value: 'contains',
  //   label: 'contains',
  //   exprSymbol: 'contains',
  //   supportedTypes: ['string'],
  // },
  // {
  //   value: 'startsWith',
  //   label: 'starts with',
  //   exprSymbol: 'startsWith',
  //   supportedTypes: ['string'],
  // },
  // {
  //   value: 'endsWith',
  //   label: 'ends with',
  //   exprSymbol: 'endsWith',
  //   supportedTypes: ['string'],
  // },
]

/**
 * Get available operators for a given field type
 */
export const getOperatorsForType = (fieldType: string): OperatorDefinition[] => {
  return FILTER_OPERATORS.filter((op) => op.supportedTypes.includes(fieldType))
}

/**
 * Check if a field type is numeric
 */
export const isNumericType = (fieldType: string): boolean => {
  return NUMERIC_TYPES.includes(fieldType)
}

/**
 * Check if an operator requires no value (null checks)
 */
export const isNoValueOperator = (operator: FilterOperator): boolean => {
  return operator === 'isNull' || operator === 'isNotNull'
}

/**
 * Check if an operator requires array value (in/notIn)
 */
export const isArrayValueOperator = (operator: FilterOperator): boolean => {
  return operator === 'in' || operator === 'notIn'
}

/**
 * Check if a field type is boolean
 */
export const isBooleanType = (fieldType: string): boolean => {
  return fieldType === 'bool'
}

/**
 * Check if a field type is string
 */
export const isStringType = (fieldType: string): boolean => {
  return fieldType === 'string'
}

/**
 * Format a value for expr expression based on type
 */
export const formatValueForExpr = (value: string | number | boolean, fieldType: string): string => {
  if (isBooleanType(fieldType)) {
    return String(value).toLowerCase() === 'true' ? 'true' : 'false'
  }
  if (isNumericType(fieldType)) {
    return String(value)
  }
  // String type - wrap in quotes and escape inner quotes
  return `"${String(value).replace(/"/g, '\\"')}"`
}

/**
 * Convert an arithmetic operand to expr string
 */
export const arithmeticOperandToExpr = (operand: ArithmeticOperand | ArithmeticExpressionNode): string => {
  if (isArithmeticExpressionNode(operand)) {
    // Recursively convert nested expressions
    return arithmeticExpressionToExpr(operand)
  }

  if (operand.type === 'field') {
    return operand.field
  }

  if (operand.type === 'function') {
    // Function call: functionName(arg1, arg2, ...)
    const args = operand.arguments.map((arg) => arithmeticOperandToExpr(arg)).join(', ')
    return `${operand.functionName}(${args})`
  }

  // Literal value
  return String(operand.value)
}

/**
 * Check if expression is a synthetic "single operand" node (left + 0) used for
 * single field/function-call left side (e.g. concat(a,b)); emit only the left.
 */
function isSyntheticSingleOperandExpression(expr: ArithmeticExpressionNode): boolean {
  return (
    expr.operator === '+' &&
    !isArithmeticExpressionNode(expr.right) &&
    expr.right.type === 'literal' &&
    expr.right.value === 0
  )
}

/**
 * Convert an arithmetic expression to expr string
 * Always wraps in parentheses for backend safety (except synthetic single-operand: emit left only)
 */
export const arithmeticExpressionToExpr = (expr: ArithmeticExpressionNode): string => {
  if (isSyntheticSingleOperandExpression(expr)) {
    return arithmeticOperandToExpr(expr.left)
  }
  const left = arithmeticOperandToExpr(expr.left)
  const right = arithmeticOperandToExpr(expr.right)

  // Wrap in parentheses to ensure correct operator precedence
  return `(${left} ${expr.operator} ${right})`
}

// =============================================================================
// Smart Display Rendering (Parentheses Flattening)
// =============================================================================

/**
 * Operator precedence for arithmetic operators (higher = binds tighter)
 */
const OPERATOR_PRECEDENCE: Record<ArithmeticOperator, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
}

/**
 * Associative operators that can be flattened when chained
 * Note: Only + and * are truly associative
 * - and / are NOT associative: (a - b) - c ≠ a - (b - c)
 */
const ASSOCIATIVE_OPERATORS: ArithmeticOperator[] = ['+', '*']

/**
 * Display symbol mapping for operators
 */
const OPERATOR_DISPLAY_SYMBOLS: Record<ArithmeticOperator, string> = {
  '+': '+',
  '-': '-',
  '*': '×',
  '/': '÷',
  '%': '%',
}

/**
 * Convert an arithmetic operand to display string
 */
const arithmeticOperandToDisplayString = (
  operand: ArithmeticOperand | ArithmeticExpressionNode,
  parentOperator?: ArithmeticOperator,
  isRightOperand?: boolean,
): string => {
  if (isArithmeticExpressionNode(operand)) {
    return arithmeticExpressionToDisplayString(operand, parentOperator, isRightOperand)
  }

  if (operand.type === 'field') {
    return operand.field
  }

  if (operand.type === 'function') {
    // Function call: functionName(arg1, arg2, ...)
    const args = operand.arguments.map((arg) => arithmeticOperandToDisplayString(arg)).join(', ')
    return `${operand.functionName}(${args})`
  }

  // Literal value
  return String(operand.value)
}

/**
 * Convert an arithmetic expression to a human-readable display string
 * with smart parentheses flattening.
 *
 * Rules:
 * 1. Associative operators (+, *): Flatten when chaining the same operator
 *    - a + b + c instead of ((a + b) + c)
 * 2. Non-associative operators (-, /, %): Keep parentheses to preserve semantics
 *    - (a - b) - c is different from a - (b - c)
 * 3. Mixed precedence: Add parentheses only when needed for correct evaluation
 *    - a + b × c needs no extra parens (standard precedence)
 *    - (a + b) × c needs parens around addition
 *
 * @param expr - The expression to convert
 * @param parentOperator - The operator of the parent expression (if any)
 * @param isRightOperand - Whether this expression is the right operand of the parent
 */
export const arithmeticExpressionToDisplayString = (
  expr: ArithmeticExpressionNode,
  parentOperator?: ArithmeticOperator,
  isRightOperand?: boolean,
): string => {
  // Synthetic single-operand (e.g. concat(a,b)): show only the left, not "+ 0"
  if (isSyntheticSingleOperandExpression(expr)) {
    return arithmeticOperandToDisplayString(expr.left, expr.operator, false)
  }

  const currentOp = expr.operator
  const currentPrecedence = OPERATOR_PRECEDENCE[currentOp]

  // Convert operands recursively
  const leftStr = arithmeticOperandToDisplayString(expr.left, currentOp, false)
  const rightStr = arithmeticOperandToDisplayString(expr.right, currentOp, true)

  // Build the expression string with display symbols
  const displayOp = OPERATOR_DISPLAY_SYMBOLS[currentOp]
  const innerExpr = `${leftStr} ${displayOp} ${rightStr}`

  // Determine if we need parentheses around this expression
  if (!parentOperator) {
    // Top-level expression: no parentheses needed
    return innerExpr
  }

  const parentPrecedence = OPERATOR_PRECEDENCE[parentOperator]
  const isAssociative = ASSOCIATIVE_OPERATORS.includes(currentOp)
  const sameOperator = currentOp === parentOperator

  // Case 1: Same associative operator - flatten (no parens)
  // e.g., a + b + c instead of (a + b) + c
  if (sameOperator && isAssociative) {
    return innerExpr
  }

  // Case 2: Current has lower precedence than parent - needs parens
  // e.g., (a + b) × c
  if (currentPrecedence < parentPrecedence) {
    return `(${innerExpr})`
  }

  // Case 3: Same precedence but different operators
  // For non-associative operators on the right side, we need parens
  // e.g., a - (b - c), a / (b / c)
  if (currentPrecedence === parentPrecedence && isRightOperand) {
    const parentIsAssociative = ASSOCIATIVE_OPERATORS.includes(parentOperator)
    if (!parentIsAssociative) {
      return `(${innerExpr})`
    }
  }

  // Case 4: Higher or equal precedence, no special cases - no parens needed
  return innerExpr
}

/**
 * Check if an arithmetic operand is complete
 */
const isArithmeticOperandComplete = (operand: ArithmeticOperand | ArithmeticExpressionNode): boolean => {
  if (isArithmeticExpressionNode(operand)) {
    return isArithmeticExpressionComplete(operand)
  }

  if (operand.type === 'literal') {
    return true
  }

  if (operand.type === 'field') {
    return operand.field !== ''
  }

  if (operand.type === 'function') {
    // Function is complete if it has a name and all arguments are complete
    if (!operand.functionName) return false
    return operand.arguments.every((arg) => isArithmeticOperandComplete(arg))
  }

  return false
}

/**
 * Check if an arithmetic expression is complete (has all required fields)
 */
export const isArithmeticExpressionComplete = (expr: ArithmeticExpressionNode | undefined): boolean => {
  if (!expr) return false

  // Check left operand
  const leftComplete = isArithmeticOperandComplete(expr.left)

  // Check right operand
  const rightComplete = isArithmeticOperandComplete(expr.right)

  return leftComplete && rightComplete && !!expr.operator
}

/**
 * Get the resulting type of an arithmetic expression (always numeric)
 */
export const getArithmeticExpressionType = (): string => {
  // Arithmetic expressions always result in a numeric type
  return 'float64'
}

/**
 * Format array value for expr expression (for in/notIn operators)
 */
export const formatArrayValueForExpr = (value: string | number | boolean, fieldType: string): string => {
  // Value should be a comma-separated string or already an array
  const stringValue = String(value)
  const items = stringValue
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')

  const formattedItems = items.map((item) => {
    if (isBooleanType(fieldType)) {
      return item.toLowerCase() === 'true' ? 'true' : 'false'
    }
    if (isNumericType(fieldType)) {
      return item
    }
    // String type - wrap in quotes
    return `"${item.replace(/"/g, '\\"')}"`
  })

  return `[${formattedItems.join(', ')}]`
}

/**
 * Convert a single rule to expr expression
 */
export const ruleToExpr = (rule: FilterRule): string => {
  const operator = FILTER_OPERATORS.find((op) => op.value === rule.operator)
  if (!operator) {
    throw new Error(`Unknown operator: ${rule.operator}`)
  }

  // Determine the left-hand side (field or arithmetic expression)
  const leftSide =
    rule.useArithmeticExpression && rule.arithmeticExpression
      ? arithmeticExpressionToExpr(rule.arithmeticExpression)
      : rule.field

  // For arithmetic expressions, the "field type" for value formatting is always numeric
  const valueType =
    rule.useArithmeticExpression && rule.arithmeticExpression ? getArithmeticExpressionType() : rule.fieldType

  let expr: string

  // Handle null check operators (no value needed)
  if (isNoValueOperator(rule.operator)) {
    expr = `${leftSide} ${operator.exprSymbol}`
  }
  // Handle in/notIn operators (array value)
  else if (isArrayValueOperator(rule.operator)) {
    const formattedValue = formatArrayValueForExpr(rule.value, valueType)
    expr = `${leftSide} ${operator.exprSymbol} ${formattedValue}`
  }
  // Handle function-style operators (contains, startsWith, endsWith) - reserved for future
  // else if (['contains', 'startsWith', 'endsWith'].includes(rule.operator)) {
  //   const formattedValue = formatValueForExpr(rule.value, valueType)
  //   expr = `${rule.operator}(${leftSide}, ${formattedValue})`
  // }
  else {
    // Handle comparison operators
    const formattedValue = formatValueForExpr(rule.value, valueType)
    expr = `${leftSide} ${operator.exprSymbol} ${formattedValue}`
  }

  // Wrap with NOT if needed
  if (rule.not) {
    return `!(${expr})`
  }

  return expr
}

/**
 * Convert a single condition to expr expression (legacy support)
 */
export const conditionToExpr = (condition: FilterCondition): string => {
  const operator = FILTER_OPERATORS.find((op) => op.value === condition.operator)
  if (!operator) {
    throw new Error(`Unknown operator: ${condition.operator}`)
  }

  // Handle null check operators (no value needed)
  if (isNoValueOperator(condition.operator)) {
    return `${condition.field} ${operator.exprSymbol}`
  }

  // Handle in/notIn operators (array value)
  if (isArrayValueOperator(condition.operator)) {
    const formattedValue = formatArrayValueForExpr(condition.value, condition.fieldType)
    return `${condition.field} ${operator.exprSymbol} ${formattedValue}`
  }

  // Handle function-style operators (contains, startsWith, endsWith) - reserved for future
  // if (['contains', 'startsWith', 'endsWith'].includes(condition.operator)) {
  //   const formattedValue = formatValueForExpr(condition.value, condition.fieldType)
  //   return `${condition.operator}(${condition.field}, ${formattedValue})`
  // }

  // Handle comparison operators
  const formattedValue = formatValueForExpr(condition.value, condition.fieldType)
  return `${condition.field} ${operator.exprSymbol} ${formattedValue}`
}

/**
 * Check if a rule is complete (has all required fields)
 */
export const isRuleComplete = (rule: FilterRule): boolean => {
  // Check left side (either field or arithmetic expression)
  const hasLeftSide = rule.useArithmeticExpression
    ? isArithmeticExpressionComplete(rule.arithmeticExpression)
    : !!rule.field

  // Null check operators don't need a value
  if (isNoValueOperator(rule.operator)) {
    return hasLeftSide && !!rule.operator
  }
  return hasLeftSide && !!rule.operator && rule.value !== undefined && rule.value !== ''
}

/**
 * Convert a group to expr expression (recursive)
 */
export const groupToExpr = (group: FilterGroup): string => {
  const expressions: string[] = []

  for (const child of group.children) {
    if (child.type === 'rule') {
      // Only include complete rules
      if (isRuleComplete(child)) {
        expressions.push(ruleToExpr(child))
      }
    } else {
      // Recursively process nested groups
      const groupExpr = groupToExpr(child)
      if (groupExpr) {
        expressions.push(groupExpr)
      }
    }
  }

  if (expressions.length === 0) {
    return ''
  }

  let result: string
  if (expressions.length === 1) {
    result = expressions[0]
  } else {
    // Combine with combinator (and/or)
    result = `(${expressions.join(` ${group.combinator} `)})`
  }

  // Wrap with NOT if needed
  if (group.not) {
    return `!(${result})`
  }

  return result
}

/**
 * Convert filter config to expr expression string
 */
export const toExprString = (config: FilterConfig): string => {
  if (!config.enabled) {
    return ''
  }

  // Use new tree structure
  if (config.root) {
    return groupToExpr(config.root)
  }

  // Legacy support for flat conditions
  if (config.conditions && config.conditions.length > 0) {
    const expressions = config.conditions
      .filter((c) => c.field && c.operator && c.value !== undefined && c.value !== '')
      .map(conditionToExpr)

    if (expressions.length === 0) {
      return ''
    }

    if (expressions.length === 1) {
      return expressions[0]
    }

    // Combine with combinator (and/or)
    return expressions.join(` ${config.combinator || 'and'} `)
  }

  return ''
}

/**
 * Validation result for a single rule
 */
export interface RuleValidation {
  isValid: boolean
  errors: {
    field?: string
    operator?: string
    value?: string
    expression?: string // Error in arithmetic expression
  }
}

// Alias for backward compatibility
export type ConditionValidation = RuleValidation

/**
 * Validation result for arithmetic expression
 */
export interface ArithmeticExpressionValidation {
  isValid: boolean
  error?: string
  /** Which operand has the error: 'left', 'right', or 'operator' */
  errorLocation?: 'left' | 'right' | 'operator'
}

/**
 * Validate an arithmetic operand
 */
const validateArithmeticOperand = (
  operand: ArithmeticOperand | ArithmeticExpressionNode,
  location: 'left' | 'right',
  isChained: boolean,
  isCurrentLevelChained: boolean,
): ArithmeticExpressionValidation | null => {
  if (isArithmeticExpressionNode(operand)) {
    const validation = validateArithmeticExpression(operand, true)
    if (!validation.isValid) {
      return validation
    }
  } else if (operand.type === 'field' && !operand.field) {
    const errorMessages = {
      left: isChained ? 'Select a field for the current expression' : 'Select a field for the left operand',
      right: isCurrentLevelChained ? 'Select a field for the next operand' : 'Select a field for the right operand',
    }
    return {
      isValid: false,
      error: errorMessages[location],
      errorLocation: location,
    }
  } else if (operand.type === 'function') {
    // Validate function call
    if (!operand.functionName) {
      return {
        isValid: false,
        error: 'Function name is required',
        errorLocation: location,
      }
    }
    // Validate function arguments
    for (const arg of operand.arguments) {
      const argValidation = validateArithmeticOperand(arg, location, isChained, isCurrentLevelChained)
      if (argValidation && !argValidation.isValid) {
        return argValidation
      }
    }
  }
  return null // No error
}

/**
 * Validate an arithmetic expression with context-aware error messages
 * @param expr - The expression to validate
 * @param isChained - Whether this is a chained expression (affects error message wording)
 */
export const validateArithmeticExpression = (
  expr: ArithmeticExpressionNode | undefined,
  isChained: boolean = false,
): ArithmeticExpressionValidation => {
  if (!expr) {
    return {
      isValid: false,
      error: 'Complete both operands to continue building the expression',
    }
  }

  // Determine if current expression level is chained (left side is an expression)
  const isCurrentLevelChained = isArithmeticExpressionNode(expr.left)

  // Validate left operand
  const leftError = validateArithmeticOperand(expr.left, 'left', isChained, isCurrentLevelChained)
  if (leftError) return leftError

  // Validate right operand
  const rightError = validateArithmeticOperand(expr.right, 'right', isChained, isCurrentLevelChained)
  if (rightError) return rightError

  // Validate operator
  if (!expr.operator) {
    return {
      isValid: false,
      error: isCurrentLevelChained ? 'Select an operator for the next operation' : 'Select an operator',
      errorLocation: 'operator',
    }
  }

  return { isValid: true }
}

/**
 * Validate a single filter rule locally (client-side)
 */
export const validateRuleLocally = (rule: FilterRule): RuleValidation => {
  const errors: RuleValidation['errors'] = {}

  // Check left side (field or arithmetic expression)
  if (rule.useArithmeticExpression) {
    const exprValidation = validateArithmeticExpression(rule.arithmeticExpression)
    if (!exprValidation.isValid) {
      errors.field = exprValidation.error || 'Invalid expression'
    }
  } else {
    // Check field is selected
    if (!rule.field) {
      errors.field = 'Field is required'
    }
  }

  // Check operator is selected
  if (!rule.operator) {
    errors.operator = 'Condition is required'
  }

  // Check value is provided (not required for null check operators)
  if (!isNoValueOperator(rule.operator)) {
    if (rule.value === undefined || rule.value === '') {
      errors.value = 'Value is required'
    }
  }

  // Determine the effective field type for validation
  // Arithmetic expressions always produce numeric results
  const effectiveFieldType = rule.useArithmeticExpression ? getArithmeticExpressionType() : rule.fieldType

  // Type-specific validation (skip for null check operators)
  if (!isNoValueOperator(rule.operator) && effectiveFieldType && rule.value !== undefined && rule.value !== '') {
    // For in/notIn operators, validate each item in the comma-separated list
    if (isArrayValueOperator(rule.operator)) {
      const items = String(rule.value)
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '')
      if (items.length === 0) {
        errors.value = 'At least one value is required'
      } else if (isNumericType(effectiveFieldType)) {
        const hasInvalidNumber = items.some((item) => isNaN(Number(item)))
        if (hasInvalidNumber) {
          errors.value = 'All values must be numbers'
        }
      } else if (isBooleanType(effectiveFieldType)) {
        const hasInvalidBool = items.some((item) => {
          const lower = item.toLowerCase()
          return lower !== 'true' && lower !== 'false'
        })
        if (hasInvalidBool) {
          errors.value = 'All values must be true or false'
        }
      }
    } else {
      // Standard single-value validation
      if (isNumericType(effectiveFieldType)) {
        // Normalize string values to handle different locale formats
        const valueToCheck =
          typeof rule.value === 'string' ? Number(normalizeNumericInput(rule.value)) : Number(rule.value)
        if (isNaN(valueToCheck)) {
          errors.value = 'Value must be a number'
        }
      }

      if (isBooleanType(effectiveFieldType)) {
        const strValue = String(rule.value).toLowerCase()
        if (strValue !== 'true' && strValue !== 'false') {
          errors.value = 'Value must be true or false'
        }
      }
    }
  }

  // Check operator is compatible with field type (skip for arithmetic expressions which are always numeric)
  if (!rule.useArithmeticExpression && rule.operator && rule.fieldType) {
    const validOperators = getOperatorsForType(rule.fieldType)
    if (!validOperators.find((op) => op.value === rule.operator)) {
      errors.operator = `Operator not supported for ${rule.fieldType} fields`
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate a single filter condition locally (legacy support)
 */
export const validateConditionLocally = (condition: FilterCondition): ConditionValidation => {
  const errors: ConditionValidation['errors'] = {}

  // Check field is selected
  if (!condition.field) {
    errors.field = 'Field is required'
  }

  // Check operator is selected
  if (!condition.operator) {
    errors.operator = 'Condition is required'
  }

  // Check value is provided (not required for null check operators)
  if (!isNoValueOperator(condition.operator)) {
    if (condition.value === undefined || condition.value === '') {
      errors.value = 'Value is required'
    }
  }

  // Type-specific validation (skip for null check operators)
  if (
    !isNoValueOperator(condition.operator) &&
    condition.fieldType &&
    condition.value !== undefined &&
    condition.value !== ''
  ) {
    // For in/notIn operators, validate each item in the comma-separated list
    if (isArrayValueOperator(condition.operator)) {
      const items = String(condition.value)
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '')
      if (items.length === 0) {
        errors.value = 'At least one value is required'
      } else if (isNumericType(condition.fieldType)) {
        const hasInvalidNumber = items.some((item) => isNaN(Number(item)))
        if (hasInvalidNumber) {
          errors.value = 'All values must be numbers'
        }
      } else if (isBooleanType(condition.fieldType)) {
        const hasInvalidBool = items.some((item) => {
          const lower = item.toLowerCase()
          return lower !== 'true' && lower !== 'false'
        })
        if (hasInvalidBool) {
          errors.value = 'All values must be true or false'
        }
      }
    } else {
      // Standard single-value validation
      if (isNumericType(condition.fieldType)) {
        // Normalize string values to handle different locale formats
        const valueToCheck =
          typeof condition.value === 'string'
            ? Number(normalizeNumericInput(condition.value))
            : Number(condition.value)
        if (isNaN(valueToCheck)) {
          errors.value = 'Value must be a number'
        }
      }

      if (isBooleanType(condition.fieldType)) {
        const strValue = String(condition.value).toLowerCase()
        if (strValue !== 'true' && strValue !== 'false') {
          errors.value = 'Value must be true or false'
        }
      }
    }
  }

  // Check operator is compatible with field type
  if (condition.operator && condition.fieldType) {
    const validOperators = getOperatorsForType(condition.fieldType)
    if (!validOperators.find((op) => op.value === condition.operator)) {
      errors.operator = `Operator not supported for ${condition.fieldType} fields`
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate the entire filter configuration locally
 */
export interface FilterConfigValidation {
  isValid: boolean
  conditionErrors: Record<string, RuleValidation['errors']>
  globalErrors: string[]
}

/**
 * Recursively validate a group and all its children
 */
const validateGroupRecursively = (
  group: FilterGroup,
  conditionErrors: Record<string, RuleValidation['errors']>,
): void => {
  for (const child of group.children) {
    if (child.type === 'rule') {
      const validation = validateRuleLocally(child)
      if (!validation.isValid) {
        conditionErrors[child.id] = validation.errors
      }
    } else {
      // Recursively validate nested groups
      validateGroupRecursively(child, conditionErrors)
    }
  }
}

/**
 * Count total rules in the tree
 */
export const countRulesInGroup = (group: FilterGroup): number => {
  let count = 0
  for (const child of group.children) {
    if (child.type === 'rule') {
      count++
    } else {
      count += countRulesInGroup(child)
    }
  }
  return count
}

/**
 * Get all rules from the tree (flattened)
 */
export const getAllRules = (group: FilterGroup): FilterRule[] => {
  const rules: FilterRule[] = []
  for (const child of group.children) {
    if (child.type === 'rule') {
      rules.push(child)
    } else {
      rules.push(...getAllRules(child))
    }
  }
  return rules
}

export const validateFilterConfigLocally = (config: FilterConfig): FilterConfigValidation => {
  const conditionErrors: Record<string, RuleValidation['errors']> = {}
  const globalErrors: string[] = []

  if (!config.enabled) {
    return { isValid: true, conditionErrors, globalErrors }
  }

  // Use new tree structure
  if (config.root) {
    const totalRules = countRulesInGroup(config.root)

    if (totalRules === 0) {
      globalErrors.push('At least one filter rule is required')
    }

    validateGroupRecursively(config.root, conditionErrors)
  } else if (config.conditions) {
    // Legacy support for flat conditions
    if (config.conditions.length === 0) {
      globalErrors.push('At least one filter condition is required')
    }

    for (const condition of config.conditions) {
      const validation = validateConditionLocally(condition)
      if (!validation.isValid) {
        conditionErrors[condition.id] = validation.errors
      }
    }
  }

  const isValid = Object.keys(conditionErrors).length === 0 && globalErrors.length === 0

  return { isValid, conditionErrors, globalErrors }
}

/**
 * Normalize numeric input to handle different locale formats
 * - Replaces comma with dot for decimal separator (e.g., "2,5" -> "2.5")
 * - Removes thousand separators if present (e.g., "1,000" -> "1000", "1.000,5" -> "1000.5")
 */
const normalizeNumericInput = (input: string): string => {
  const trimmed = input.trim()

  // If input contains both dot and comma, determine which is decimal separator
  // Common patterns:
  // - "1,234.56" (English) -> comma is thousand separator, dot is decimal
  // - "1.234,56" (European) -> dot is thousand separator, comma is decimal
  if (trimmed.includes('.') && trimmed.includes(',')) {
    const lastDot = trimmed.lastIndexOf('.')
    const lastComma = trimmed.lastIndexOf(',')

    if (lastComma > lastDot) {
      // European format: "1.234,56" -> remove dots, replace comma with dot
      return trimmed.replace(/\./g, '').replace(',', '.')
    } else {
      // English format: "1,234.56" -> just remove commas
      return trimmed.replace(/,/g, '')
    }
  }

  // If only comma present, treat as decimal separator (e.g., "2,5" -> "2.5")
  if (trimmed.includes(',')) {
    return trimmed.replace(',', '.')
  }

  // Otherwise return as-is (already valid or just has dots)
  return trimmed
}

/**
 * Parse a value from string input based on field type
 */
export const parseValueForType = (inputValue: string, fieldType: string): string | number | boolean => {
  if (isBooleanType(fieldType)) {
    return inputValue.toLowerCase() === 'true'
  }
  if (isNumericType(fieldType)) {
    // Allow empty string to be preserved (for clearing the field)
    if (inputValue === '' || inputValue.trim() === '') {
      return ''
    }
    // Normalize the input to handle different locale formats
    const normalizedInput = normalizeNumericInput(inputValue)
    const num = Number(normalizedInput)
    return isNaN(num) ? inputValue : num
  }
  return inputValue
}

/**
 * Get default value for a field type
 */
export const getDefaultValueForType = (fieldType: string): string | number | boolean => {
  if (isBooleanType(fieldType)) {
    return true
  }
  if (isNumericType(fieldType)) {
    return 0
  }
  return ''
}
