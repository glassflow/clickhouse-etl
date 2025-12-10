import { useStore } from '../index'
import { TransformationConfig, TransformationField } from '../transformation.store'
import { v4 as uuidv4 } from 'uuid'

/**
 * Hydrate transformation configuration from pipeline config
 * This restores the transformation state when loading an existing pipeline for viewing/editing
 */
export function hydrateTransformation(pipelineConfig: any) {
  const transformation = pipelineConfig?.transformation
  const transformationStore = useStore.getState().transformationStore

  if (!transformation) {
    // No transformation config - reset to initial state
    transformationStore.resetTransformationStore()
    return
  }

  // Set transformation enabled state
  const enabled = !!transformation.enabled

  if (!enabled) {
    transformationStore.resetTransformationStore()
    return
  }

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
