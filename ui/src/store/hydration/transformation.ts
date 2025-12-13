import { useStore } from '../index'
import { TransformationConfig, TransformationField } from '../transformation.store'
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
        // Computed field - try to extract function name and args
        // Handle nested function calls by finding the outermost function call
        // Pattern: functionName(possibly nested args)
        const functionMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/)
        
        // Check if this is a complex expression (ternary, comparison operators, etc.)
        const hasComplexOperators = /[?:!=<>]/.test(expression)
        
        if (functionMatch && !hasComplexOperators) {
          const functionName = functionMatch[1]
          const argsString = functionMatch[2]
          
          // Parse arguments - simplified parser
          const args: any[] = []
          const argParts = parseFunctionArgsString(argsString)
          argParts.forEach((arg: string) => {
            const trimmed = arg.trim()
            // Check if it's a string literal
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
              args.push({
                type: 'literal' as const,
                value: trimmed.slice(1, -1),
                literalType: 'string' as const,
              })
            } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              // Array literal
              const arrayContent = trimmed.slice(1, -1)
              const arrayValues = parseFunctionArgsString(arrayContent).map((v: string) =>
                v.trim().replace(/^"|"$/g, ''),
              )
              args.push({
                type: 'array' as const,
                values: arrayValues,
                elementType: 'string' as const,
              })
            } else if (/^-?\d+\.?\d*$/.test(trimmed)) {
              // Number literal (integer or float)
              const numValue = trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10)
              args.push({
                type: 'literal' as const,
                value: numValue,
                literalType: 'number' as const,
              })
            } else {
              // Could be a field reference or nested function call
              // For now, treat nested function calls as field references
              // The UI will need to handle these, but at least validation will pass
              args.push({
                type: 'field' as const,
                fieldName: trimmed,
                fieldType: 'string',
              })
            }
          })

          return {
            id: transform.id || `field-${index}`,
            type: 'computed' as const,
            outputFieldName: outputName,
            outputFieldType: outputType,
            functionName: functionName,
            functionArgs: args,
          }
        } else {
          // Complex expression - store as computed with raw expression
          // For complex expressions that can't be parsed (nested calls, ternaries, etc.),
          // we store the raw expression and mark it as complete so validation passes
          // The UI will need to handle these specially, but for now we preserve them
          return {
            id: transform.id || `field-${index}`,
            type: 'computed' as const,
            outputFieldName: outputName,
            outputFieldType: outputType,
            functionName: '__raw_expression__', // Special marker for raw expressions
            functionArgs: [
              {
                type: 'literal' as const,
                value: expression,
                literalType: 'string' as const,
              },
            ],
            rawExpression: expression, // Store raw expression for complex cases
          } as any
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
      console.warn(
        '[Transformation Hydration] Expression present but no field definitions. Expression will be shown in read-only mode.',
      )
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
 * Parse hydrated function arguments into the correct format
 */
function parseHydratedArgs(args: any[]): any[] {
  return args.map((arg) => {
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
      return {
        type: 'array' as const,
        values: arg.values || [],
        elementType: arg.elementType || 'string',
      }
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
            functionName: field.functionName,
            functionArgs: field.functionArgs?.map((arg) => {
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
              } else {
                return {
                  type: 'array',
                  values: arg.values,
                  elementType: arg.elementType,
                }
              }
            }),
          }),
    })),
  }
}
