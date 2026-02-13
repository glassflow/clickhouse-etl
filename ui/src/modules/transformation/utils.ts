/**
 * Transformation Utilities
 *
 * Functions for generating transformation expressions, validating configurations,
 * and computing intermediary schemas.
 */

import {
  TransformationConfig,
  TransformationField,
  FunctionArg,
  FunctionArgField,
  FunctionArgLiteral,
  FunctionArgArray,
  FunctionArgNestedFunction,
  FunctionArgWaterfallArray,
  FunctionArgConcatArray,
  WaterfallSlot,
  ConcatSlot,
  PostProcessFunction,
  TransformArithmeticExpression,
  isFieldComplete,
  isNestedFunctionArg,
} from '@/src/store/transformation.store'
import { getFunctionByName, TransformationFunctionDef } from './functions'

/**
 * Validation result for a transformation field
 */
export interface FieldValidation {
  isValid: boolean
  errors: {
    outputFieldName?: string
    functionName?: string
    functionArgs?: string
    sourceField?: string
    rawExpression?: string
    arithmeticExpression?: string
    general?: string
  }
}

/**
 * Validation result for entire transformation config
 */
export interface TransformationConfigValidation {
  isValid: boolean
  fieldErrors: Record<string, FieldValidation['errors']>
  globalErrors: string[]
}

/**
 * Schema field type for intermediary schema
 */
export interface IntermediarySchemaField {
  name: string
  type: string
  sourceField?: string // For passthrough fields
  functionName?: string // For computed fields (function composer mode)
  rawExpression?: string // For computed fields (raw expression mode)
}

/**
 * Check if a function argument is a field reference
 */
export const isFieldArg = (arg: FunctionArg): arg is FunctionArgField => {
  return arg.type === 'field'
}

/**
 * Check if a function argument is a literal value
 */
export const isLiteralArg = (arg: FunctionArg): arg is FunctionArgLiteral => {
  return arg.type === 'literal'
}

/**
 * Check if a function argument is an array
 */
export const isArrayArg = (arg: FunctionArg): arg is FunctionArgArray => {
  return arg.type === 'array'
}

/**
 * Check if a function argument is a nested function call
 */
export const isNestedFunctionArgUtil = (arg: FunctionArg): arg is FunctionArgNestedFunction => {
  return arg.type === 'nested_function'
}

/**
 * Check if a function argument is a waterfall array
 */
export const isWaterfallArrayArg = (arg: FunctionArg): arg is FunctionArgWaterfallArray => {
  return arg.type === 'waterfall_array'
}

/**
 * Check if a function argument is a concat array
 */
export const isConcatArrayArg = (arg: FunctionArg): arg is FunctionArgConcatArray => {
  return arg.type === 'concat_array'
}

/**
 * Convert a concat slot to its expression string
 */
export const concatSlotToExpr = (slot: ConcatSlot): string => {
  switch (slot.slotType) {
    case 'field':
      return slot.fieldName || ''
    case 'literal':
      // String literal - escape quotes
      const escaped = (slot.literalValue || '').replace(/"/g, '\\"')
      return `"${escaped}"`
    default:
      return ''
  }
}

/**
 * Convert a concat array argument to its expression string (comma-separated values)
 * If postProcessChain is present, wraps the concat with the chain of functions
 * e.g., toUpper(trim(concat(field1, " ", field2)))
 */
export const concatArrayToExpr = (arg: FunctionArgConcatArray): string => {
  const slotExprs = arg.slots.map(concatSlotToExpr).filter(Boolean)
  const innerExpr = slotExprs.join(', ')

  // If no post-process chain, return just the inner arguments (caller wraps with concat())
  if (!arg.postProcessChain || arg.postProcessChain.length === 0) {
    return innerExpr
  }

  // Apply post-process chain - wrap concat result with each function in order
  // Chain is stored as [innermost, ..., outermost], so we build from inside out
  let expr = `concat(${innerExpr})`

  for (const func of arg.postProcessChain) {
    if (!func.functionName) continue

    const additionalArgsStr = func.additionalArgs.map(formatArgForExpr).join(', ')
    expr = `${func.functionName}(${expr}${additionalArgsStr ? ', ' + additionalArgsStr : ''})`
  }

  return expr
}

/**
 * Format a function argument for the expression (supports nested functions)
 */
export const formatArgForExpr = (arg: FunctionArg): string => {
  if (isFieldArg(arg)) {
    // Field reference - use the field name directly
    return arg.fieldName
  }

  if (isLiteralArg(arg)) {
    // Literal value - format based on type
    if (arg.literalType === 'string') {
      return `"${String(arg.value).replace(/"/g, '\\"')}"`
    }
    return String(arg.value)
  }

  if (isArrayArg(arg)) {
    // Array value - can contain nested functions
    const formattedValues = arg.values.map((v) => {
      // Check if value is a nested function argument
      if (typeof v === 'object' && v !== null && 'type' in v) {
        return formatArgForExpr(v as FunctionArg)
      }
      if (arg.elementType === 'string') {
        return `"${String(v).replace(/"/g, '\\"')}"`
      }
      return String(v)
    })
    return `[${formattedValues.join(', ')}]`
  }

  if (isNestedFunctionArgUtil(arg)) {
    // Nested function call - recursively generate expression
    return nestedFunctionToExpr(arg)
  }

  if (isWaterfallArrayArg(arg)) {
    // Waterfall array - convert slots to expressions
    return waterfallArrayToExpr(arg)
  }

  if (isConcatArrayArg(arg)) {
    // Concat array - convert slots to comma-separated expressions
    return concatArrayToExpr(arg)
  }

  return ''
}

/**
 * Convert a waterfall slot to its expression string
 */
export const waterfallSlotToExpr = (slot: WaterfallSlot): string => {
  switch (slot.slotType) {
    case 'field':
      return slot.fieldName || ''
    case 'literal':
      if (slot.literalType === 'number') {
        return slot.literalValue || '0'
      }
      // String literal - escape quotes
      const escaped = (slot.literalValue || '').replace(/"/g, '\\"')
      return `"${escaped}"`
    case 'function':
      if (!slot.functionName) return ''
      const args = (slot.functionArgs || []).map(formatArgForExpr)
      return `${slot.functionName}(${args.join(', ')})`
    default:
      return ''
  }
}

/**
 * Convert a waterfall array argument to its expression string
 */
export const waterfallArrayToExpr = (arg: FunctionArgWaterfallArray): string => {
  const slotExprs = arg.slots.map(waterfallSlotToExpr).filter(Boolean)
  return `[${slotExprs.join(', ')}]`
}

/**
 * Generate expression for a nested function argument
 */
export const nestedFunctionToExpr = (arg: FunctionArgNestedFunction): string => {
  if (!arg.functionName) {
    return ''
  }
  const args = arg.functionArgs.map(formatArgForExpr)
  return `${arg.functionName}(${args.join(', ')})`
}

/**
 * Format arithmetic expression suffix
 */
export const formatArithmeticExpr = (arithmetic: TransformArithmeticExpression): string => {
  return ` ${arithmetic.operator} ${arithmetic.operand}`
}

/**
 * Generate expression for a computed field
 */
export const computedFieldToExpr = (field: TransformationField): string => {
  if (field.type !== 'computed') {
    return ''
  }

  // Handle raw expression mode
  if (field.expressionMode === 'raw' && field.rawExpression) {
    return field.rawExpression
  }

  // Handle legacy raw expressions (complex expressions that couldn't be parsed)
  if (field.functionName === '__raw_expression__') {
    const rawExpr = field.rawExpression
    if (rawExpr) {
      return rawExpr
    }
    // Fallback: try to extract from first literal argument
    if (field.functionArgs && field.functionArgs.length > 0) {
      const firstArg = field.functionArgs[0]
      if (isLiteralArg(firstArg)) {
        return String(firstArg.value)
      }
    }
    return ''
  }

  // Handle field + arithmetic only (no function)
  // This allows expressions like "timestamp * 1000000" without a wrapping function
  if (!field.functionName && field.functionArgs && field.functionArgs.length > 0) {
    const firstArg = field.functionArgs[0]
    if (isFieldArg(firstArg) && firstArg.fieldName && field.arithmeticExpression) {
      return firstArg.fieldName + formatArithmeticExpr(field.arithmeticExpression)
    }
    return ''
  }

  // Need function name and args for simple/nested modes
  if (!field.functionName || !field.functionArgs) {
    return ''
  }

  // Special handling for concat with post-process chain
  // When concat has a post-process chain, concatArrayToExpr returns the full wrapped expression
  if (field.functionName === 'concat' && field.functionArgs.length === 1) {
    const firstArg = field.functionArgs[0]
    if (isConcatArrayArg(firstArg) && firstArg.postProcessChain && firstArg.postProcessChain.length > 0) {
      // concatArrayToExpr already returns the full expression with wrapping functions
      let expr = concatArrayToExpr(firstArg)
      // Apply arithmetic expression if present
      if (field.arithmeticExpression) {
        expr = expr + formatArithmeticExpr(field.arithmeticExpression)
      }
      return expr
    }
  }

  // Generate the function call expression (handles nested functions via formatArgForExpr)
  const args = field.functionArgs.map(formatArgForExpr)
  let expr = `${field.functionName}(${args.join(', ')})`

  // Apply arithmetic expression if present
  if (field.arithmeticExpression) {
    expr = expr + formatArithmeticExpr(field.arithmeticExpression)
  }

  return expr
}

/**
 * Generate expression for a passthrough field
 */
export const passthroughFieldToExpr = (field: TransformationField): string => {
  if (field.type !== 'passthrough' || !field.sourceField) {
    return ''
  }

  let expr = field.sourceField

  // Apply arithmetic expression if present
  if (field.arithmeticExpression) {
    expr = expr + formatArithmeticExpr(field.arithmeticExpression)
  }

  return expr
}

/**
 * Generate expression for a single transformation field
 */
export const fieldToExpr = (field: TransformationField): string => {
  if (field.type === 'computed') {
    return computedFieldToExpr(field)
  }
  return passthroughFieldToExpr(field)
}

/**
 * Generate the full transformation expression
 * Returns an object mapping output field names to their expressions
 */
export const toTransformationExpr = (config: TransformationConfig): string => {
  if (!config.enabled || config.fields.length === 0) {
    return ''
  }

  const mappings = config.fields
    .filter(isFieldComplete)
    .map((field) => {
      const expr = fieldToExpr(field)
      if (!expr) return null
      return `"${field.outputFieldName}": ${expr}`
    })
    .filter(Boolean)

  if (mappings.length === 0) {
    return ''
  }

  return `{${mappings.join(', ')}}`
}

/**
 * Validate a nested function argument recursively
 */
export const validateNestedFunctionArg = (arg: FunctionArgNestedFunction): { isValid: boolean; error?: string } => {
  if (!arg.functionName) {
    return { isValid: false, error: 'Nested function name is required' }
  }

  const funcDef = getFunctionByName(arg.functionName)
  if (!funcDef) {
    return { isValid: false, error: `Unknown nested function: ${arg.functionName}` }
  }

  // Validate nested function arguments
  const requiredArgs = funcDef.args.filter((a) => a.required !== false)
  if (!arg.functionArgs || arg.functionArgs.length < requiredArgs.length) {
    return { isValid: false, error: `Nested function ${arg.functionName} requires ${requiredArgs.length} argument(s)` }
  }

  // Recursively validate each nested argument
  for (let i = 0; i < arg.functionArgs.length; i++) {
    const nestedArg = arg.functionArgs[i]
    if (isNestedFunctionArgUtil(nestedArg)) {
      const nestedValidation = validateNestedFunctionArg(nestedArg)
      if (!nestedValidation.isValid) {
        return nestedValidation
      }
    } else if (isFieldArg(nestedArg)) {
      if (!nestedArg.fieldName) {
        return { isValid: false, error: `Field selection required for argument ${i + 1}` }
      }
    }
    // Literals and arrays are considered valid if they exist
  }

  return { isValid: true }
}

/**
 * Validate a single waterfall slot
 */
export const validateWaterfallSlot = (slot: WaterfallSlot, index: number): { isValid: boolean; error?: string } => {
  switch (slot.slotType) {
    case 'field':
      if (!slot.fieldName) {
        return { isValid: false, error: `Slot ${index + 1}: Field selection required` }
      }
      break
    case 'literal':
      if (slot.literalValue === undefined || slot.literalValue === '') {
        return { isValid: false, error: `Slot ${index + 1}: Literal value required` }
      }
      break
    case 'function':
      if (!slot.functionName) {
        return { isValid: false, error: `Slot ${index + 1}: Function selection required` }
      }
      const funcDef = getFunctionByName(slot.functionName)
      if (!funcDef) {
        return { isValid: false, error: `Slot ${index + 1}: Unknown function: ${slot.functionName}` }
      }
      // Validate function arguments
      const requiredArgs = funcDef.args.filter((a) => a.required !== false)
      if (!slot.functionArgs || slot.functionArgs.length < requiredArgs.length) {
        return {
          isValid: false,
          error: `Slot ${index + 1}: Function ${slot.functionName} requires ${requiredArgs.length} argument(s)`,
        }
      }
      // Check each argument
      for (let i = 0; i < requiredArgs.length; i++) {
        const argDef = requiredArgs[i]
        const argValue = slot.functionArgs[i]
        if (!argValue) {
          return { isValid: false, error: `Slot ${index + 1}: Argument "${argDef.name}" is required` }
        }
        if (argDef.type === 'field' && isFieldArg(argValue) && !argValue.fieldName) {
          return { isValid: false, error: `Slot ${index + 1}: Field selection required for "${argDef.name}"` }
        }
        if (
          argDef.type === 'literal' &&
          isLiteralArg(argValue) &&
          (argValue.value === undefined || argValue.value === '')
        ) {
          return { isValid: false, error: `Slot ${index + 1}: Value required for "${argDef.name}"` }
        }
      }
      break
  }
  return { isValid: true }
}

/**
 * Validate a waterfall array argument
 */
export const validateWaterfallArrayArg = (arg: FunctionArgWaterfallArray): { isValid: boolean; error?: string } => {
  if (!arg.slots || arg.slots.length < 2) {
    return { isValid: false, error: 'Waterfall requires at least 2 expressions' }
  }

  for (let i = 0; i < arg.slots.length; i++) {
    const slotValidation = validateWaterfallSlot(arg.slots[i], i)
    if (!slotValidation.isValid) {
      return slotValidation
    }
  }

  return { isValid: true }
}

/**
 * Validate a single concat slot
 */
export const validateConcatSlot = (slot: ConcatSlot, index: number): { isValid: boolean; error?: string } => {
  switch (slot.slotType) {
    case 'field':
      if (!slot.fieldName) {
        return { isValid: false, error: `Value ${index + 1}: Field selection required` }
      }
      break
    case 'literal':
      // Allow empty strings for concat (e.g., space separator)
      if (slot.literalValue === undefined) {
        return { isValid: false, error: `Value ${index + 1}: Text value required` }
      }
      break
  }
  return { isValid: true }
}

/**
 * Validate a single post-process function in a concat chain
 */
export const validatePostProcessFunction = (
  func: PostProcessFunction,
  index: number,
): { isValid: boolean; error?: string } => {
  if (!func.functionName) {
    return { isValid: false, error: `Post-process function ${index + 1}: Function selection required` }
  }

  const funcDef = getFunctionByName(func.functionName)
  if (!funcDef) {
    return { isValid: false, error: `Post-process function ${index + 1}: Unknown function: ${func.functionName}` }
  }

  // Validate additional arguments (skip first arg which is the piped concat result)
  const additionalArgDefs = funcDef.args.slice(1)
  const requiredAdditionalArgs = additionalArgDefs.filter((a) => a.required !== false)

  if (func.additionalArgs.length < requiredAdditionalArgs.length) {
    return {
      isValid: false,
      error: `Post-process function ${index + 1}: ${func.functionName} requires ${requiredAdditionalArgs.length} additional argument(s)`,
    }
  }

  // Validate each additional argument
  for (let i = 0; i < requiredAdditionalArgs.length; i++) {
    const argDef = requiredAdditionalArgs[i]
    const argValue = func.additionalArgs[i]

    if (!argValue) {
      return {
        isValid: false,
        error: `Post-process function ${index + 1}: Argument "${argDef.name}" is required`,
      }
    }

    if (argDef.type === 'field' && isFieldArg(argValue) && !argValue.fieldName) {
      return {
        isValid: false,
        error: `Post-process function ${index + 1}: Field selection required for "${argDef.name}"`,
      }
    }

    if (
      argDef.type === 'literal' &&
      isLiteralArg(argValue) &&
      (argValue.value === undefined || argValue.value === '')
    ) {
      return {
        isValid: false,
        error: `Post-process function ${index + 1}: Value required for "${argDef.name}"`,
      }
    }
  }

  return { isValid: true }
}

/**
 * Validate a concat array argument
 */
export const validateConcatArrayArg = (arg: FunctionArgConcatArray): { isValid: boolean; error?: string } => {
  if (!arg.slots || arg.slots.length < 1) {
    return { isValid: false, error: 'Concat requires at least 1 value' }
  }

  for (let i = 0; i < arg.slots.length; i++) {
    const slotValidation = validateConcatSlot(arg.slots[i], i)
    if (!slotValidation.isValid) {
      return slotValidation
    }
  }

  // Validate post-process chain if present
  if (arg.postProcessChain && arg.postProcessChain.length > 0) {
    for (let i = 0; i < arg.postProcessChain.length; i++) {
      const funcValidation = validatePostProcessFunction(arg.postProcessChain[i], i)
      if (!funcValidation.isValid) {
        return funcValidation
      }
    }
  }

  return { isValid: true }
}

/**
 * Validate a single transformation field
 */
export const validateFieldLocally = (field: TransformationField): FieldValidation => {
  const errors: FieldValidation['errors'] = {}

  // Check output field name
  // Allow standard identifiers (start with letter/underscore) OR fields starting with @ (e.g., @timestamp from Elasticsearch)
  if (!field.outputFieldName || field.outputFieldName.trim() === '') {
    errors.outputFieldName = 'Output field name is required'
  } else if (!/^(@?[a-zA-Z_][a-zA-Z0-9_]*|@[a-zA-Z0-9_]+)$/.test(field.outputFieldName)) {
    errors.outputFieldName =
      'Field name must start with a letter, underscore, or @ and contain only alphanumeric characters and underscores'
  }

  if (field.type === 'computed') {
    // Handle raw expression mode
    if (field.expressionMode === 'raw') {
      if (!field.rawExpression || field.rawExpression.trim() === '') {
        errors.rawExpression = 'Expression is required'
      }
      // Raw expressions are assumed valid if non-empty (backend will validate)
    }
    // Handle legacy raw expression marker
    else if (field.functionName === '__raw_expression__') {
      const rawExpr = field.rawExpression
      const hasRawExprInArgs =
        field.functionArgs &&
        field.functionArgs.length > 0 &&
        isLiteralArg(field.functionArgs[0]) &&
        field.functionArgs[0].value
      if (!rawExpr && !hasRawExprInArgs) {
        errors.general = 'Raw expression is missing'
      }
    }
    // Handle simple and nested modes
    else {
      // Check if this is a "field + arithmetic only" case (no function needed)
      const hasSourceFieldArg =
        field.functionArgs?.[0]?.type === 'field' &&
        isFieldArg(field.functionArgs[0]) &&
        field.functionArgs[0].fieldName
      const hasValidArithmetic = field.arithmeticExpression && !isNaN(field.arithmeticExpression.operand)

      if (hasSourceFieldArg && hasValidArithmetic) {
        // Valid: field + arithmetic without function - no function error needed
        // Still validate the arithmetic operand below
      } else if (!field.functionName) {
        errors.functionName = 'Function is required for computed fields (or select a source field with arithmetic)'
      } else {
        const funcDef = getFunctionByName(field.functionName)
        if (!funcDef) {
          errors.functionName = `Unknown function: ${field.functionName}`
        } else {
          // Validate function arguments
          const requiredArgs = funcDef.args.filter((a) => a.required !== false)
          if (!field.functionArgs || field.functionArgs.length < requiredArgs.length) {
            errors.functionArgs = `Function ${field.functionName} requires ${requiredArgs.length} argument(s)`
          } else {
            // Check each argument (including nested functions)
            for (let i = 0; i < requiredArgs.length; i++) {
              const argDef = requiredArgs[i]
              const argValue = field.functionArgs[i]

              if (!argValue) {
                errors.functionArgs = `Argument "${argDef.name}" is required`
                break
              }

              // Validate waterfall array arguments
              if (isWaterfallArrayArg(argValue)) {
                const waterfallValidation = validateWaterfallArrayArg(argValue)
                if (!waterfallValidation.isValid) {
                  errors.functionArgs = waterfallValidation.error
                  break
                }
              }
              // Validate concat array arguments
              else if (isConcatArrayArg(argValue)) {
                const concatValidation = validateConcatArrayArg(argValue)
                if (!concatValidation.isValid) {
                  errors.functionArgs = concatValidation.error
                  break
                }
              }
              // Validate nested function arguments recursively
              else if (isNestedFunctionArgUtil(argValue)) {
                const nestedValidation = validateNestedFunctionArg(argValue)
                if (!nestedValidation.isValid) {
                  errors.functionArgs = nestedValidation.error
                  break
                }
              } else if (argDef.type === 'field' && isFieldArg(argValue)) {
                if (!argValue.fieldName) {
                  errors.functionArgs = `Field selection required for argument "${argDef.name}"`
                  break
                }
              } else if (argDef.type === 'literal' && isLiteralArg(argValue)) {
                if (argValue.value === undefined || argValue.value === '') {
                  errors.functionArgs = `Value required for argument "${argDef.name}"`
                  break
                }
              }
            }
          }
        }
      }

      // Validate arithmetic expression if present
      if (field.arithmeticExpression) {
        if (isNaN(field.arithmeticExpression.operand)) {
          errors.arithmeticExpression = 'Arithmetic operand must be a valid number'
        }
      }
    }
  } else if (field.type === 'passthrough') {
    // Validate passthrough field
    if (!field.sourceField) {
      errors.sourceField = 'Source field is required for passthrough fields'
    }
    // Validate arithmetic expression if present
    if (field.arithmeticExpression) {
      if (isNaN(field.arithmeticExpression.operand)) {
        errors.arithmeticExpression = 'Arithmetic operand must be a valid number'
      }
    }
    // Note: sourceFieldType is optional - if not provided, we'll infer it
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate the entire transformation configuration
 */
export const validateTransformationConfig = (config: TransformationConfig): TransformationConfigValidation => {
  const fieldErrors: Record<string, FieldValidation['errors']> = {}
  const globalErrors: string[] = []

  if (!config.enabled) {
    return { isValid: true, fieldErrors, globalErrors }
  }

  if (config.fields.length === 0) {
    globalErrors.push('At least one transformation field is required when transformations are enabled')
    return { isValid: false, fieldErrors, globalErrors }
  }

  // Check for duplicate output field names
  const outputNames = config.fields.map((f) => f.outputFieldName).filter(Boolean)
  const duplicates = outputNames.filter((name, index) => outputNames.indexOf(name) !== index)
  if (duplicates.length > 0) {
    globalErrors.push(`Duplicate output field names: ${[...new Set(duplicates)].join(', ')}`)
  }

  // Validate each field
  for (const field of config.fields) {
    const validation = validateFieldLocally(field)
    if (!validation.isValid) {
      fieldErrors[field.id] = validation.errors
    }
  }

  const isValid = Object.keys(fieldErrors).length === 0 && globalErrors.length === 0

  return { isValid, fieldErrors, globalErrors }
}

/**
 * Get the intermediary schema from transformation configuration
 */
export const getIntermediarySchema = (config: TransformationConfig): IntermediarySchemaField[] => {
  if (!config.enabled || config.fields.length === 0) {
    return []
  }

  return config.fields.filter(isFieldComplete).map((field) => {
    const schemaField: IntermediarySchemaField = {
      name: field.outputFieldName,
      type: field.outputFieldType,
    }

    if (field.type === 'passthrough') {
      schemaField.sourceField = field.sourceField
    } else {
      // Check if it's a raw expression mode
      if (field.expressionMode === 'raw' && field.rawExpression) {
        schemaField.rawExpression = field.rawExpression
      } else {
        // Function composer mode
        schemaField.functionName = field.functionName
      }
    }

    return schemaField
  })
}

/**
 * Infer the output type for a computed field based on its function
 */
export const inferOutputType = (functionName: string): string => {
  const funcDef = getFunctionByName(functionName)
  if (funcDef) {
    return funcDef.returnType
  }
  return 'string' // Default to string if unknown
}

/**
 * Create a field argument
 */
export const createFieldArg = (fieldName: string, fieldType: string): FunctionArgField => ({
  type: 'field',
  fieldName,
  fieldType,
})

/**
 * Create a literal argument
 */
export const createLiteralArg = (
  value: string | number | boolean,
  literalType: 'string' | 'number' | 'boolean',
): FunctionArgLiteral => ({
  type: 'literal',
  value,
  literalType,
})

/**
 * Create an array argument
 */
export const createArrayArg = (
  values: (string | number | FunctionArg)[],
  elementType: 'string' | 'number' | 'nested_function',
): FunctionArgArray => ({
  type: 'array',
  values,
  elementType,
})

/**
 * Create a nested function argument
 */
export const createNestedFunctionArg = (
  functionName: string,
  functionArgs: FunctionArg[],
): FunctionArgNestedFunction => ({
  type: 'nested_function',
  functionName,
  functionArgs,
})

/**
 * Create an arithmetic expression
 */
export const createArithmeticExpr = (
  operator: '+' | '-' | '*' | '/' | '%',
  operand: number,
): TransformArithmeticExpression => ({
  operator,
  operand,
})

/**
 * Count complete fields in the configuration
 */
export const countCompleteFields = (config: TransformationConfig): number => {
  return config.fields.filter(isFieldComplete).length
}

/**
 * Get all complete fields
 */
export const getCompleteFields = (config: TransformationConfig): TransformationField[] => {
  return config.fields.filter(isFieldComplete)
}
