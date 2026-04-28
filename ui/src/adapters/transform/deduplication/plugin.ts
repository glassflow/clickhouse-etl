import type { SchemaField } from '@/src/types/schema'
import type { DeduplicationConfig } from '@/src/store/deduplication.store'
import { useStore } from '@/src/store/index'
import { registerTransformPlugin } from '../registry'
import type { TransformPlugin, WireTransformConfig } from '../registry'

/** Wire shape for a single deduplication config entry (per-topic) */
export interface WireDeduplicationConfig extends WireTransformConfig {
  type: 'deduplication'
  enabled: boolean
  id_field: string
  id_field_type: string
  time_window: string
}

/** Validates that a string is a valid Go duration (e.g. "24h", "30m", "60s") */
function isValidGoDuration(value: string): boolean {
  if (!value || value.trim() === '') return false
  // Must match one or more: <number><unit> where unit is s, m, h, d, ms, us, ns
  return /^(\d+(?:\.\d+)?(h|m(?!s)|s|ms|us|ns|d))+$/.test(value.trim())
}

/** Build the time_window string from a dedup config */
function buildTimeWindow(config: DeduplicationConfig): string {
  if (!config.window) return '1h'
  const unitChar = config.unit?.charAt(0) ?? 'h'
  return `${config.window}${unitChar}`
}

const deduplicationPlugin: TransformPlugin<DeduplicationConfig> = {
  type: 'deduplication',

  get enabled(): boolean {
    const state = useStore.getState()
    const configs = state.deduplicationStore.deduplicationConfigs
    return Object.values(configs).some((c) => c?.enabled === true)
  },

  getInputSchema(upstream: SchemaField[]): SchemaField[] {
    return upstream
  },

  getOutputSchema(input: SchemaField[], _config: DeduplicationConfig): SchemaField[] {
    // Deduplication does not change the schema shape — it only filters duplicate rows
    return input
  },

  validate(config: DeduplicationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.enabled) {
      return { valid: true, errors }
    }

    if (!config.key || config.key.trim() === '') {
      errors.push('Deduplication key (id_field) is required when deduplication is enabled')
    }

    const timeWindow = buildTimeWindow(config)
    if (!isValidGoDuration(timeWindow)) {
      errors.push(
        `Time window "${timeWindow}" is not a valid Go duration string (e.g. "24h", "30m", "60s")`,
      )
    }

    return { valid: errors.length === 0, errors }
  },

  toWireFormat(config: DeduplicationConfig): WireDeduplicationConfig {
    return {
      type: 'deduplication',
      enabled: config.enabled,
      id_field: config.key,
      id_field_type: config.keyType,
      time_window: buildTimeWindow(config),
    }
  },

  fromWireFormat(wire: WireTransformConfig): DeduplicationConfig {
    const w = wire as WireDeduplicationConfig

    // Parse time_window back into window + unit
    const timeWindow = (w.time_window as string) ?? '1h'
    const match = timeWindow.match(/^(\d+(?:\.\d+)?)(h|m|s|d)/)
    const window = match ? parseFloat(match[1]) : 1
    const rawUnit = match ? match[2] : 'h'
    const unitMap: Record<string, DeduplicationConfig['unit']> = {
      s: 'seconds',
      m: 'minutes',
      h: 'hours',
      d: 'days',
    }
    const unit: DeduplicationConfig['unit'] = unitMap[rawUnit] ?? 'hours'

    return {
      enabled: Boolean(w.enabled),
      key: (w.id_field as string) ?? '',
      keyType: (w.id_field_type as string) ?? '',
      window,
      unit,
    }
  },
}

registerTransformPlugin(deduplicationPlugin)

export { deduplicationPlugin }
