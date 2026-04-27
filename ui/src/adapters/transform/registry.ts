import type { SchemaField } from '@/src/types/schema'

export type TransformType = 'deduplication' | 'join' | 'filter' | 'stateless'

export interface WireTransformConfig {
  type: TransformType
  [key: string]: unknown
}

export interface TransformPlugin<TConfig = unknown> {
  readonly type: TransformType
  readonly enabled: boolean
  getInputSchema(upstream: SchemaField[]): SchemaField[]
  getOutputSchema(input: SchemaField[], config: TConfig): SchemaField[]
  validate(config: TConfig): { valid: boolean; errors: string[] }
  toWireFormat(config: TConfig): WireTransformConfig
  fromWireFormat(wire: WireTransformConfig): TConfig
}

// Registry
const registry = new Map<TransformType, TransformPlugin>()

export function registerTransformPlugin(plugin: TransformPlugin): void {
  registry.set(plugin.type, plugin)
}

export function getTransformPlugin(type: TransformType): TransformPlugin {
  const plugin = registry.get(type)
  if (!plugin) throw new Error(`No transform plugin registered for type: ${type}`)
  return plugin
}

export function getAllTransformPlugins(): TransformPlugin[] {
  return Array.from(registry.values())
}
