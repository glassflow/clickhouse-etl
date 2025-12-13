import { useStore } from '../index'
import {
  TransformationConfig,
  TransformationField,
  FunctionArg,
  FunctionArgNestedFunction,
  TransformArithmeticExpression,
  ExpressionMode,
} from '../transformation.store'
import { v4 as uuidv4 } from 'uuid'

/**
 * Hydrate transformation configuration from pipeline config
 * This restores the transformation state when loading an existing pipeline for viewing/editing
 * Supports both internal format (transformation) and API format (stateless_transformation)
 */
export function hydrateTransformation(pipelineConfig: any) {
  const transformationStore = useStore.getState().transformationStore

  // Check for stateless_transformation (V2 API format) first
  const statelessTransformation = pipelineConfig?.stateless_transformation
  // Fall back to transformation (internal format) for backward compatibility
  const transformation = pipelineConfig?.transformation

  // Use stateless_transformation if available, otherwise use transformation
  const transformConfig = statelessTransformation || transformation

  if (!transformConfig) {
    // No transformation config - reset to initial state
    transformationStore.resetTransformationStore()
    return
  }

  // Set transformation enabled state
  const enabled = !!transformConfig.enabled

  if (!enabled) {
    transformationStore.resetTransformationStore()
    return
  }

  // Handle stateless_transformation format
  if (statelessTransformation && statelessTransformation.config?.transform) {
    const transformArray = statelessTransformation.config.transform || []
    const fields: TransformationField[] = transformArray.map((transform: any, index: number) => {
      const expression = transform.expression || ''
      const outputName = transform.output_name || ''
      const outputType = transform.output_type || 'string'

      // Try to parse expression to determine if passthrough or computed
      // Simple heuristic: if expression is just a field name (no parentheses, no function calls), it's passthrough
      const isPassthrough = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression.trim())

      if (isPassthrough) {
        // Passthrough field
        return {
          id: transform.id || `field-${index}`,
          type: 'passthrough' as const,
          outputFieldName: outputName,
          outputFieldType: outputType,
          sourceField: expression.trim(),
          sourceFieldType: outputType,
        }
      } else {
        // Computed field - determine expression mode and parse accordingly
        const expressionMode = determineExpressionMode(expression)

        // Check for arithmetic modifier first
        const { baseExpr, arithmetic } = parseArithmeticModifier(expression)

        if (expressionMode === 'raw') {
          // Complex expression - store as raw
          return {
            id: transform.id || `field-${index}`,
            type: 'computed' as const,
            outputFieldName: outputName,
            outputFieldType: outputType,
            expressionMode: 'raw' as const,
            rawExpression: expression,
            functionName: '__raw_expression__', // Legacy marker for backward compatibility
            functionArgs: [
              {
                type: 'literal' as const,
                value: expression,
                literalType: 'string' as const,
              },
            ],
          }
        }

        // Parse function call (simple or nested)
        const exprToParse = arithmetic ? baseExpr : expression
        const functionMatch = exprToParse.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/)

        if (functionMatch) {
          const functionName = functionMatch[1]
          const argsString = functionMatch[2]

          // Parse arguments with support for nested functions
          const argParts = parseFunctionArgsString(argsString)
          const args: FunctionArg[] = argParts.map(parseArgument)

          return {
            id: transform.id || `field-${index}`,
            type: 'computed' as const,
            outputFieldName: outputName,
            outputFieldType: outputType,
            expressionMode,
            functionName,
            functionArgs: args,
            arithmeticExpression: arithmetic,
          }
        } else {
          // Fallback - store as raw expression
          return {
            id: transform.id || `field-${index}`,
            type: 'computed' as const,
            outputFieldName: outputName,
            outputFieldType: outputType,
            expressionMode: 'raw' as const,
            rawExpression: expression,
            functionName: '__raw_expression__',
            functionArgs: [
              {
                type: 'literal' as const,
                value: expression,
                literalType: 'string' as const,
              },
            ],
          }
        }
      }
    })

    const config: TransformationConfig = {
      enabled: true,
      fields,
    }

    transformationStore.setTransformationConfig(config)
    transformationStore.markAsValid()
    return
  }

  // Handle internal transformation format (backward compatibility)
  if (transformation) {
    // Set the expression string if available
    if (transformation.expression) {
      transformationStore.setExpressionString(transformation.expression)
    }

    // If we have field definitions, reconstruct the transformation config
    if (transformation.fields && Array.isArray(transformation.fields)) {
      const fields: TransformationField[] = transformation.fields.map((fieldDef: any) => {
        const field: TransformationField = {
          id: fieldDef.id || uuidv4(),
          type: fieldDef.type || 'passthrough',
          outputFieldName: fieldDef.outputFieldName || fieldDef.name || '',
          outputFieldType: fieldDef.outputFieldType || fieldDef.type || 'string',
        }

        if (field.type === 'passthrough') {
          field.sourceField = fieldDef.sourceField || ''
          field.sourceFieldType = fieldDef.sourceFieldType || 'string'
        } else if (field.type === 'computed') {
          field.functionName = fieldDef.functionName || ''
          field.functionArgs = parseHydratedArgs(fieldDef.functionArgs || [])
        }

        return field
      })

      const config: TransformationConfig = {
        enabled: true,
        fields,
      }

      transformationStore.setTransformationConfig(config)
      transformationStore.markAsValid()
    } else if (transformation.expression) {
      // We have an expression but no field definitions
      // This could happen if the pipeline was created with an older version
      // For now, just keep the expression string and mark as valid
      transformationStore.setTransformationConfig({
        enabled: true,
        fields: [],
      })
      transformationStore.markAsValid()
    }
  }
}

/**
 * Helper function to parse function arguments from a string
 * Handles basic cases - may not work for all complex expressions
 */
function parseFunctionArgsString(argsString: string): string[] {
  const args: string[] = []
  let current = ''
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i]

    if ((char === '"' || char === "'") && (i === 0 || argsString[i - 1] !== '\\')) {
      if (!inString) {
        inString = true
        stringChar = char
        current += char
      } else if (char === stringChar) {
        inString = false
        stringChar = ''
        current += char
      } else {
        current += char
      }
    } else if (!inString) {
      if (char === '(' || char === '[') {
        depth++
        current += char
      } else if (char === ')' || char === ']') {
        depth--
        current += char
      } else if (char === ',' && depth === 0) {
        args.push(current.trim())
        current = ''
      } else {
        current += char
      }
    } else {
      current += char
    }
  }

  if (current.trim()) {
    args.push(current.trim())
  }

  return args
}

/**
 * Check if an expression contains a nested function call
 */
function isNestedFunctionCall(expr: string): boolean {
  // Check for pattern: functionName(args)
  return /^[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*\)$/.test(expr.trim())
}

/**
 * Parse a single argument string into a FunctionArg
 * Handles nested function calls recursively
 */
function parseArgument(argStr: string): FunctionArg {
  const trimmed = argStr.trim()

  // String literal
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return {
      type: 'literal' as const,
      value: trimmed.slice(1, -1),
      literalType: 'string' as const,
    }
  }

  // Array literal - may contain nested function calls
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const arrayContent = trimmed.slice(1, -1)
    const arrayArgs = parseFunctionArgsString(arrayContent)
    const values: (string | number | FunctionArg)[] = arrayArgs.map((v) => {
      const itemTrimmed = v.trim()
      // Check if array item is a nested function call
      if (isNestedFunctionCall(itemTrimmed)) {
        return parseNestedFunction(itemTrimmed)
      }
      // String literal in array
      if (itemTrimmed.startsWith('"') && itemTrimmed.endsWith('"')) {
        return itemTrimmed.slice(1, -1)
      }
      // Number
      if (/^-?\d+\.?\d*$/.test(itemTrimmed)) {
        return parseFloat(itemTrimmed)
      }
      return itemTrimmed
    })

    // Determine element type
    const hasNestedFunction = values.some((v) => typeof v === 'object' && v !== null && 'type' in v)
    const elementType = hasNestedFunction ? ('nested_function' as const) : ('string' as const)

    return {
      type: 'array' as const,
      values,
      elementType,
    }
  }

  // Number literal
  if (/^-?\d+\.?\d*$/.test(trimmed)) {
    const numValue = trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10)
    return {
      type: 'literal' as const,
      value: numValue,
      literalType: 'number' as const,
    }
  }

  // Nested function call
  if (isNestedFunctionCall(trimmed)) {
    return parseNestedFunction(trimmed)
  }

  // Field reference
  return {
    type: 'field' as const,
    fieldName: trimmed,
    fieldType: 'string',
  }
}

/**
 * Parse a nested function call expression
 */
function parseNestedFunction(expr: string): FunctionArgNestedFunction {
  const match = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/)
  if (!match) {
    // Fallback - treat as a field reference wrapped in a function
    return {
      type: 'nested_function',
      functionName: '',
      functionArgs: [],
    }
  }

  const functionName = match[1]
  const argsString = match[2]
  const argStrings = parseFunctionArgsString(argsString)
  const functionArgs = argStrings.map(parseArgument)

  return {
    type: 'nested_function',
    functionName,
    functionArgs,
  }
}

/**
 * Check if expression has arithmetic modifier at the end
 * Pattern: expr * number, expr / number, etc.
 */
function parseArithmeticModifier(expr: string): { baseExpr: string; arithmetic?: TransformArithmeticExpression } {
  // Match pattern: (expression) operator number OR functionCall(...) operator number
  // We need to be careful not to match operators inside function calls
  const arithmeticMatch = expr.match(/^(.+?)\s*([+\-*/%])\s*(\d+\.?\d*)$/)

  if (arithmeticMatch) {
    const baseExpr = arithmeticMatch[1].trim()
    const operator = arithmeticMatch[2] as TransformArithmeticExpression['operator']
    const operand = parseFloat(arithmeticMatch[3])

    // Make sure the base expression is complete (balanced parentheses)
    let depth = 0
    for (const char of baseExpr) {
      if (char === '(') depth++
      if (char === ')') depth--
    }

    if (depth === 0) {
      return {
        baseExpr,
        arithmetic: { operator, operand },
      }
    }
  }

  return { baseExpr: expr }
}

/**
 * Determine the expression mode based on the expression complexity
 */
function determineExpressionMode(expression: string): ExpressionMode {
  // Check for ternary operators - always raw
  if (/\?.*:/.test(expression)) {
    return 'raw'
  }

  // Check for comparison operators outside function calls - raw
  if (/[!=<>]/.test(expression)) {
    // Check if the comparison is outside of any function call
    let depth = 0
    for (let i = 0; i < expression.length; i++) {
      const char = expression[i]
      if (char === '(') depth++
      if (char === ')') depth--
      if (depth === 0 && (char === '!' || char === '=' || char === '<' || char === '>')) {
        return 'raw'
      }
    }
  }

  // Check for nested function calls
  const funcMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/)
  if (funcMatch) {
    const argsString = funcMatch[2]
    // Check if any argument contains a function call
    const args = parseFunctionArgsString(argsString)
    for (const arg of args) {
      if (isNestedFunctionCall(arg.trim())) {
        return 'nested'
      }
      // Check for arrays with nested functions
      if (arg.trim().startsWith('[')) {
        const arrayContent = arg.trim().slice(1, -1)
        const arrayItems = parseFunctionArgsString(arrayContent)
        for (const item of arrayItems) {
          if (isNestedFunctionCall(item.trim())) {
            return 'nested'
          }
        }
      }
    }
  }

  return 'simple'
}

/**
 * Parse hydrated function arguments into the correct format
 */
function parseHydratedArgs(args: any[]): FunctionArg[] {
  return args.map((arg): FunctionArg => {
    if (arg.type === 'field') {
      return {
        type: 'field' as const,
        fieldName: arg.fieldName || arg.field || '',
        fieldType: arg.fieldType || 'string',
      }
    } else if (arg.type === 'literal') {
      return {
        type: 'literal' as const,
        value: arg.value ?? '',
        literalType: arg.literalType || 'string',
      }
    } else if (arg.type === 'array') {
      // Parse array values, including nested functions
      const values = (arg.values || []).map((v: any) => {
        if (typeof v === 'object' && v !== null && v.type === 'nested_function') {
          return parseHydratedNestedFunction(v)
        }
        return v
      })
      return {
        type: 'array' as const,
        values,
        elementType: arg.elementType || 'string',
      }
    } else if (arg.type === 'nested_function') {
      return parseHydratedNestedFunction(arg)
    }
    // Default to literal
    return {
      type: 'literal' as const,
      value: String(arg),
      literalType: 'string',
    }
  })
}

/**
 * Parse a hydrated nested function argument
 */
function parseHydratedNestedFunction(arg: any): FunctionArgNestedFunction {
  return {
    type: 'nested_function' as const,
    functionName: arg.functionName || '',
    functionArgs: parseHydratedArgs(arg.functionArgs || []),
  }
}

/**
 * Export a function argument for saving
 */
function exportFunctionArg(arg: FunctionArg): any {
  if (arg.type === 'field') {
    return {
      type: 'field',
      fieldName: arg.fieldName,
      fieldType: arg.fieldType,
    }
  } else if (arg.type === 'literal') {
    return {
      type: 'literal',
      value: arg.value,
      literalType: arg.literalType,
    }
  } else if (arg.type === 'array') {
    return {
      type: 'array',
      values: arg.values.map((v) => {
        if (typeof v === 'object' && v !== null && 'type' in v) {
          return exportFunctionArg(v as FunctionArg)
        }
        return v
      }),
      elementType: arg.elementType,
    }
  } else if (arg.type === 'nested_function') {
    return {
      type: 'nested_function',
      functionName: arg.functionName,
      functionArgs: arg.functionArgs.map(exportFunctionArg),
    }
  }
  return arg
}

/**
 * Export transformation config for saving to backend
 */
export function exportTransformationConfig(): any {
  const { transformationConfig, expressionString } = useStore.getState().transformationStore

  if (!transformationConfig.enabled || transformationConfig.fields.length === 0) {
    return null
  }

  return {
    enabled: transformationConfig.enabled,
    expression: expressionString,
    fields: transformationConfig.fields.map((field) => ({
      id: field.id,
      type: field.type,
      outputFieldName: field.outputFieldName,
      outputFieldType: field.outputFieldType,
      ...(field.type === 'passthrough'
        ? {
            sourceField: field.sourceField,
            sourceFieldType: field.sourceFieldType,
          }
        : {
            expressionMode: field.expressionMode,
            rawExpression: field.rawExpression,
            arithmeticExpression: field.arithmeticExpression,
            functionName: field.functionName,
            functionArgs: field.functionArgs?.map(exportFunctionArg),
          }),
    })),
  }
}
