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
  isFieldComplete,
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
  functionName?: string // For computed fields
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
 * Format a function argument for the expression
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
    // Array value
    const formattedValues = arg.values.map((v) => {
      if (arg.elementType === 'string') {
        return `"${String(v).replace(/"/g, '\\"')}"`
      }
      return String(v)
    })
    return `[${formattedValues.join(', ')}]`
  }

  return ''
}

/**
 * Generate expression for a computed field
 */
export const computedFieldToExpr = (field: TransformationField): string => {
  if (field.type !== 'computed' || !field.functionName || !field.functionArgs) {
    return ''
  }

  // Handle raw expressions (complex expressions that couldn't be parsed)
  if (field.functionName === '__raw_expression__') {
    const rawExpr = (field as any).rawExpression
    if (rawExpr) {
      return rawExpr
    }
    // Fallback: try to extract from first literal argument
    const firstArg = field.functionArgs[0]
    if (isLiteralArg(firstArg)) {
      return String(firstArg.value)
    }
    return ''
  }

  const args = field.functionArgs.map(formatArgForExpr)
  return `${field.functionName}(${args.join(', ')})`
}

/**
 * Generate expression for a passthrough field
 */
export const passthroughFieldToExpr = (field: TransformationField): string => {
  if (field.type !== 'passthrough' || !field.sourceField) {
    return ''
  }

  // For passthrough, just reference the field directly
  return field.sourceField
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
 * Validate a single transformation field
 */
export const validateFieldLocally = (field: TransformationField): FieldValidation => {
  const errors: FieldValidation['errors'] = {}

  // Check output field name
  if (!field.outputFieldName || field.outputFieldName.trim() === '') {
    errors.outputFieldName = 'Output field name is required'
  } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.outputFieldName)) {
    errors.outputFieldName =
      'Field name must start with a letter or underscore and contain only alphanumeric characters and underscores'
  }

  if (field.type === 'computed') {
    // Validate computed field
    if (!field.functionName) {
      errors.functionName = 'Function is required for computed fields'
    } else if (field.functionName === '__raw_expression__') {
      // Special case: raw expression (complex expressions that can't be parsed)
      // These are valid - they come from hydrated configs with complex expressions
      // Check that we have the raw expression stored (either in rawExpression or in functionArgs)
      const rawExpr = (field as any).rawExpression
      const hasRawExprInArgs =
        field.functionArgs &&
        field.functionArgs.length > 0 &&
        isLiteralArg(field.functionArgs[0]) &&
        field.functionArgs[0].value
      if (!rawExpr && !hasRawExprInArgs) {
        errors.general = 'Raw expression is missing'
      }
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
          // Check each argument
          for (let i = 0; i < requiredArgs.length; i++) {
            const argDef = requiredArgs[i]
            const argValue = field.functionArgs[i]

            if (!argValue) {
              errors.functionArgs = `Argument "${argDef.name}" is required`
              break
            }

            if (argDef.type === 'field' && isFieldArg(argValue)) {
              if (!argValue.fieldName) {
                errors.functionArgs = `Field selection required for argument "${argDef.name}"`
                break
              }
            }

            if (argDef.type === 'literal' && isLiteralArg(argValue)) {
              if (argValue.value === undefined || argValue.value === '') {
                errors.functionArgs = `Value required for argument "${argDef.name}"`
                break
              }
            }
          }
        }
      }
    }
  } else if (field.type === 'passthrough') {
    // Validate passthrough field
    if (!field.sourceField) {
      errors.sourceField = 'Source field is required for passthrough fields'
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
      schemaField.functionName = field.functionName
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
export const createArrayArg = (values: (string | number)[], elementType: 'string' | 'number'): FunctionArgArray => ({
  type: 'array',
  values,
  elementType,
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
