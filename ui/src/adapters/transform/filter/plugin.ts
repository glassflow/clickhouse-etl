import type { SchemaField } from '@/src/types/schema'
import type { FilterConfig } from '@/src/store/filter.store'
import { useStore } from '@/src/store/index'
import { registerTransformPlugin } from '../registry'
import type { TransformPlugin, WireTransformConfig } from '../registry'

/** Wire shape for filter configuration */
export interface WireFilterConfig extends WireTransformConfig {
  type: 'filter'
  enabled: boolean
  expression: string
}

/** The config type the filter plugin works with */
export interface FilterPluginConfig {
  enabled: boolean
  /** The compiled expression string (from filterStore.expressionString) */
  expression: string
  /** The full filter config tree (optional — used for UI reconstruction) */
  filterConfig?: FilterConfig
}

const filterPlugin: TransformPlugin<FilterPluginConfig> = {
  type: 'filter',

  get enabled(): boolean {
    return useStore.getState().filterStore.filterConfig.enabled
  },

  getInputSchema(upstream: SchemaField[]): SchemaField[] {
    return upstream
  },

  getOutputSchema(input: SchemaField[], _config: FilterPluginConfig): SchemaField[] {
    // Filter does not change the schema shape — it only removes rows that don't match
    return input
  },

  validate(config: FilterPluginConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.enabled) {
      return { valid: true, errors }
    }

    if (!config.expression || config.expression.trim() === '') {
      errors.push('Filter expression is required when filter is enabled')
    }

    return { valid: errors.length === 0, errors }
  },

  toWireFormat(config: FilterPluginConfig): WireFilterConfig {
    // The backend uses negated expression: !(expression) means "keep rows where expression is false"
    const wireExpression =
      config.expression && config.expression.trim()
        ? `!(${config.expression})`
        : config.expression

    return {
      type: 'filter',
      enabled: config.enabled,
      expression: wireExpression,
    }
  },

  fromWireFormat(wire: WireTransformConfig): FilterPluginConfig {
    const w = wire as WireFilterConfig
    // Strip the !(…) wrapper added by toWireFormat, if present
    let expression = (w.expression as string) ?? ''
    const negatedMatch = expression.match(/^!\((.+)\)$/)
    if (negatedMatch) {
      expression = negatedMatch[1]
    }

    return {
      enabled: Boolean(w.enabled),
      expression,
    }
  },
}

registerTransformPlugin(filterPlugin)

export { filterPlugin }
