import {
  FilterCondition,
  FilterConfig,
  FilterOperator,
  FilterRule,
  FilterGroup,
} from '@/src/store/filter.store'

// Operator definitions with display labels and type compatibility
export interface OperatorDefinition {
  value: FilterOperator
  label: string
  exprSymbol: string
  supportedTypes: string[] // Field types that support this operator
}

export const FILTER_OPERATORS: OperatorDefinition[] = [
  {
    value: 'eq',
    label: 'equals',
    exprSymbol: '==',
    supportedTypes: [
      'string',
      'int',
      'int8',
      'int16',
      'int32',
      'int64',
      'uint',
      'uint8',
      'uint16',
      'uint32',
      'uint64',
      'float',
      'float32',
      'float64',
      'bool',
    ],
  },
  {
    value: 'neq',
    label: 'not equals',
    exprSymbol: '!=',
    supportedTypes: [
      'string',
      'int',
      'int8',
      'int16',
      'int32',
      'int64',
      'uint',
      'uint8',
      'uint16',
      'uint32',
      'uint64',
      'float',
      'float32',
      'float64',
      'bool',
    ],
  },
  {
    value: 'gt',
    label: 'greater than',
    exprSymbol: '>',
    supportedTypes: [
      'int',
      'int8',
      'int16',
      'int32',
      'int64',
      'uint',
      'uint8',
      'uint16',
      'uint32',
      'uint64',
      'float',
      'float32',
      'float64',
    ],
  },
  {
    value: 'gte',
    label: 'greater than or equals',
    exprSymbol: '>=',
    supportedTypes: [
      'int',
      'int8',
      'int16',
      'int32',
      'int64',
      'uint',
      'uint8',
      'uint16',
      'uint32',
      'uint64',
      'float',
      'float32',
      'float64',
    ],
  },
  {
    value: 'lt',
    label: 'less than',
    exprSymbol: '<',
    supportedTypes: [
      'int',
      'int8',
      'int16',
      'int32',
      'int64',
      'uint',
      'uint8',
      'uint16',
      'uint32',
      'uint64',
      'float',
      'float32',
      'float64',
    ],
  },
  {
    value: 'lte',
    label: 'less than or equals',
    exprSymbol: '<=',
    supportedTypes: [
      'int',
      'int8',
      'int16',
      'int32',
      'int64',
      'uint',
      'uint8',
      'uint16',
      'uint32',
      'uint64',
      'float',
      'float32',
      'float64',
    ],
  },
  {
    value: 'contains',
    label: 'contains',
    exprSymbol: 'contains',
    supportedTypes: ['string'],
  },
  {
    value: 'startsWith',
    label: 'starts with',
    exprSymbol: 'startsWith',
    supportedTypes: ['string'],
  },
  {
    value: 'endsWith',
    label: 'ends with',
    exprSymbol: 'endsWith',
    supportedTypes: ['string'],
  },
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
  const numericTypes = [
    'int',
    'int8',
    'int16',
    'int32',
    'int64',
    'uint',
    'uint8',
    'uint16',
    'uint32',
    'uint64',
    'float',
    'float32',
    'float64',
  ]
  return numericTypes.includes(fieldType)
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
 * Convert a single rule to expr expression
 */
export const ruleToExpr = (rule: FilterRule): string => {
  const operator = FILTER_OPERATORS.find((op) => op.value === rule.operator)
  if (!operator) {
    throw new Error(`Unknown operator: ${rule.operator}`)
  }

  const formattedValue = formatValueForExpr(rule.value, rule.fieldType)

  let expr: string
  // Handle function-style operators (contains, startsWith, endsWith)
  if (['contains', 'startsWith', 'endsWith'].includes(rule.operator)) {
    expr = `${rule.operator}(${rule.field}, ${formattedValue})`
  } else {
    // Handle comparison operators
    expr = `${rule.field} ${operator.exprSymbol} ${formattedValue}`
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

  const formattedValue = formatValueForExpr(condition.value, condition.fieldType)

  // Handle function-style operators (contains, startsWith, endsWith)
  if (['contains', 'startsWith', 'endsWith'].includes(condition.operator)) {
    return `${condition.operator}(${condition.field}, ${formattedValue})`
  }

  // Handle comparison operators
  return `${condition.field} ${operator.exprSymbol} ${formattedValue}`
}

/**
 * Check if a rule is complete (has all required fields)
 */
export const isRuleComplete = (rule: FilterRule): boolean => {
  return !!(rule.field && rule.operator && rule.value !== undefined && rule.value !== '')
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
  }
}

// Alias for backward compatibility
export type ConditionValidation = RuleValidation

/**
 * Validate a single filter rule locally (client-side)
 */
export const validateRuleLocally = (rule: FilterRule): RuleValidation => {
  const errors: RuleValidation['errors'] = {}

  // Check field is selected
  if (!rule.field) {
    errors.field = 'Field is required'
  }

  // Check operator is selected
  if (!rule.operator) {
    errors.operator = 'Condition is required'
  }

  // Check value is provided
  if (rule.value === undefined || rule.value === '') {
    errors.value = 'Value is required'
  }

  // Type-specific validation
  if (rule.fieldType && rule.value !== undefined && rule.value !== '') {
    if (isNumericType(rule.fieldType)) {
      const numValue = Number(rule.value)
      if (isNaN(numValue)) {
        errors.value = 'Value must be a number'
      }
    }

    if (isBooleanType(rule.fieldType)) {
      const strValue = String(rule.value).toLowerCase()
      if (strValue !== 'true' && strValue !== 'false') {
        errors.value = 'Value must be true or false'
      }
    }
  }

  // Check operator is compatible with field type
  if (rule.operator && rule.fieldType) {
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

  // Check value is provided
  if (condition.value === undefined || condition.value === '') {
    errors.value = 'Value is required'
  }

  // Type-specific validation
  if (condition.fieldType && condition.value !== undefined && condition.value !== '') {
    if (isNumericType(condition.fieldType)) {
      const numValue = Number(condition.value)
      if (isNaN(numValue)) {
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
 * Parse a value from string input based on field type
 */
export const parseValueForType = (inputValue: string, fieldType: string): string | number | boolean => {
  if (isBooleanType(fieldType)) {
    return inputValue.toLowerCase() === 'true'
  }
  if (isNumericType(fieldType)) {
    const num = Number(inputValue)
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
