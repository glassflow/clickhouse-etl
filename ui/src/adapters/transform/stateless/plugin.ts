import type { SchemaField } from '@/src/types/schema'
import type { InternalFieldType } from '@/src/types/schema'
import type { TransformationConfig, TransformationField } from '@/src/store/transformation.store'
import { isFieldComplete } from '@/src/store/transformation.store'
import { useStore } from '@/src/store/index'
import { normalizeFieldType } from '@/src/utils/type-conversion'
import { registerTransformPlugin } from '../registry'
import type { TransformPlugin, WireTransformConfig } from '../registry'

/** Wire shape for a single transformation field entry */
export interface WireTransformField {
  expression: string
  output_name: string
  output_type: string
}

/** Wire shape for stateless transformation configuration */
export interface WireStatelessConfig extends WireTransformConfig {
  type: 'stateless'
  enabled: boolean
  expression: string
  fields: WireTransformField[]
}

const statelessPlugin: TransformPlugin<TransformationConfig> = {
  type: 'stateless',

  get enabled(): boolean {
    const { transformationConfig } = useStore.getState().transformationStore
    return transformationConfig.enabled && transformationConfig.fields.length > 0
  },

  getInputSchema(upstream: SchemaField[]): SchemaField[] {
    return upstream
  },

  getOutputSchema(input: SchemaField[], config: TransformationConfig): SchemaField[] {
    if (!config.enabled || config.fields.length === 0) {
      return input
    }

    const completeFields = config.fields.filter(isFieldComplete)
    if (completeFields.length === 0) {
      return input
    }

    // Build output schema from transformation fields:
    // - passthrough fields preserve their named output
    // - computed fields add new fields with specified output type
    const outputFields: SchemaField[] = completeFields.map((field: TransformationField) => ({
      name: field.outputFieldName,
      type: normalizeFieldType(field.outputFieldType) as InternalFieldType,
      nullable: false,
      source: 'transform' as const,
      originalType: field.outputFieldType,
    }))

    return outputFields
  },

  validate(config: TransformationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.enabled) {
      return { valid: true, errors }
    }

    if (!config.fields || config.fields.length === 0) {
      errors.push('At least one transformation field expression is required when transformation is enabled')
    }

    return { valid: errors.length === 0, errors }
  },

  toWireFormat(config: TransformationConfig): WireStatelessConfig {
    return {
      type: 'stateless',
      enabled: config.enabled,
      expression: '',
      fields: config.fields
        .filter(isFieldComplete)
        .map((field: TransformationField) => ({
          expression: field.rawExpression ?? field.functionName ?? field.sourceField ?? '',
          output_name: field.outputFieldName,
          output_type: field.outputFieldType,
        })),
    }
  },

  fromWireFormat(wire: WireTransformConfig): TransformationConfig {
    const w = wire as WireStatelessConfig
    const wireFields = (w.fields as WireTransformField[]) ?? []

    return {
      enabled: Boolean(w.enabled),
      fields: wireFields.map((wf, idx) => ({
        id: String(idx),
        type: 'computed' as const,
        outputFieldName: wf.output_name,
        outputFieldType: wf.output_type,
        functionName: wf.expression,
        functionArgs: [],
        expressionMode: 'raw' as const,
        rawExpression: wf.expression,
      })),
    }
  },
}

registerTransformPlugin(statelessPlugin)

export { statelessPlugin }
