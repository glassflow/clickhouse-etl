import type { SchemaField } from '@/src/types/schema'
import type { JoinStoreProps } from '@/src/store/join.store'
import { useStore } from '@/src/store/index'
import { registerTransformPlugin } from '../registry'
import type { TransformPlugin, WireTransformConfig } from '../registry'

/** Wire shape for join configuration */
export interface WireJoinConfig extends WireTransformConfig {
  type: 'join'
  enabled: boolean
  joinType: string
  sources: Array<{
    source_id: string
    join_key: string
    time_window: string
    orientation: string
  }>
}

/** The config type the join plugin works with (subset of JoinStoreProps) */
export type JoinPluginConfig = Pick<JoinStoreProps, 'enabled' | 'type' | 'streams'>

const joinPlugin: TransformPlugin<JoinPluginConfig> = {
  type: 'join',

  get enabled(): boolean {
    return useStore.getState().joinStore.enabled
  },

  getInputSchema(upstream: SchemaField[]): SchemaField[] {
    return upstream
  },

  getOutputSchema(input: SchemaField[], config: JoinPluginConfig): SchemaField[] {
    if (!config.enabled || config.streams.length < 2) {
      return input
    }

    // Join merges fields from both input topics. The registry interface receives
    // only one input SchemaField[] (from upstream), so for a join we return the
    // input as-is — schema merging from both topics is handled by getEffectiveSchema
    // which has access to the full topics store.  This plugin's getOutputSchema is
    // a safe no-op pass-through; the schema-service handles join merging directly.
    return input
  },

  validate(config: JoinPluginConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.enabled) {
      return { valid: true, errors }
    }

    if (!config.streams || config.streams.length < 2) {
      errors.push('Join requires at least two streams')
    }

    for (const stream of config.streams ?? []) {
      if (!stream.joinKey || stream.joinKey.trim() === '') {
        errors.push(`Stream "${stream.streamId}" is missing a join key`)
      }
      if (!stream.topicName || stream.topicName.trim() === '') {
        errors.push(`Stream "${stream.streamId}" is missing a topic name`)
      }
    }

    return { valid: errors.length === 0, errors }
  },

  toWireFormat(config: JoinPluginConfig): WireJoinConfig {
    return {
      type: 'join',
      enabled: config.enabled,
      joinType: config.type || 'temporal',
      sources: (config.streams ?? []).map((stream) => ({
        source_id: stream.topicName,
        join_key: stream.joinKey,
        time_window: `${stream.joinTimeWindowValue}${stream.joinTimeWindowUnit.charAt(0)}`,
        orientation: stream.orientation,
      })),
    }
  },

  fromWireFormat(wire: WireTransformConfig): JoinPluginConfig {
    const w = wire as WireJoinConfig
    return {
      enabled: Boolean(w.enabled),
      type: (w.joinType as string) || 'temporal',
      streams: ((w.sources as WireJoinConfig['sources']) ?? []).map((src, idx) => ({
        streamId: src.source_id,
        topicName: src.source_id,
        joinKey: src.join_key,
        joinTimeWindowValue: parseFloat(src.time_window) || 1,
        joinTimeWindowUnit: src.time_window.replace(/[\d.]+/, '') || 'h',
        orientation: (src.orientation as 'left' | 'right') ?? (idx === 0 ? 'left' : 'right'),
      })),
    }
  },
}

registerTransformPlugin(joinPlugin)

export { joinPlugin }
