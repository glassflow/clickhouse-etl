import { useStore } from '../index'
import { getPipelineAdapter } from '@/src/modules/pipeline-adapters/factory'
import { hydrateClickhouseDestination } from './clickhouse-destination'
import { hydrateFilter } from './filter'
import { hydrateTransformation } from './transformation'
import { structuredLogger } from '@/src/observability'

/**
 * Partially hydrates the store from a historical schema binding config.
 *
 * Unlike enterViewMode / hydrateFromConfig, this function:
 * - Does NOT re-fetch topics or events from Kafka (preserves existing event data)
 * - Does NOT update the Kafka connection (unchanged across bindings)
 * - DOES update: topic schema fields + version, CH mapping, filter, transformation, deduplication
 * - Updates baseConfig and lastSavedConfig so discard/dirty checks work against this binding
 *
 * Used when user selects a historical schema binding from SchemaBindingsSection.
 */
export async function hydrateFromSchemaBinding(rawConfig: any): Promise<void> {
  try {
    const adapter = getPipelineAdapter(rawConfig.version || 'v1')
    const internalConfig = adapter.hydrate(rawConfig)

    const { topicsStore, deduplicationStore, coreStore } = useStore.getState()

    // 1. Update topic schema fields and schema version for each topic
    //    Preserve existing event data, topic name, initialOffset — only schema changes
    if (internalConfig.source?.topics) {
      internalConfig.source.topics.forEach((topicConfig: any, idx: number) => {
        const existingTopic = topicsStore.getTopic(idx)
        if (!existingTopic) return

        let schema = existingTopic.schema
        if (topicConfig.schema?.fields && Array.isArray(topicConfig.schema.fields)) {
          schema = {
            fields: topicConfig.schema.fields.map((f: any) => ({
              name: f.name,
              type: f.type || 'string',
              userType: f.type || 'string',
            })),
          }
        }

        const schemaSource = topicConfig.schema_registry?.url ? 'external' : 'internal'

        topicsStore.updateTopic({
          ...existingTopic,
          schema,
          schemaSource: schemaSource as 'internal' | 'external' | 'registry_resolved_from_event',
          schemaRegistryVersion: topicConfig.schema_version,
        })

        // Update deduplication for this topic index if config differs
        if (topicConfig.deduplication) {
          const timeWindow = topicConfig.deduplication.time_window || '1h'
          const parsedDuration = parseDuration(timeWindow)
          deduplicationStore.updateDeduplication(idx, {
            enabled: topicConfig.deduplication.enabled ?? false,
            key: topicConfig.deduplication.id_field ?? '',
            keyType: topicConfig.deduplication.id_field_type ?? 'string',
            window: parsedDuration.value,
            unit: parsedDuration.unit,
          })
        }
      })
    }

    // 2. Update ClickHouse mapping from this binding's config
    await hydrateClickhouseDestination(internalConfig)

    // 3. Update filter
    hydrateFilter(internalConfig)

    // 4. Update transformation
    hydrateTransformation(internalConfig)

    // 5. Update baseConfig and lastSavedConfig so discard works correctly for this binding
    coreStore.setBaseConfig(internalConfig as any)
    coreStore.setLastSavedConfig(internalConfig as any)

    structuredLogger.info('hydrateFromSchemaBinding completed', {
      pipeline_id: internalConfig.pipeline_id,
      topics: JSON.stringify(internalConfig.source?.topics?.map((t: any) => ({ name: t.name, version: t.schema_version }))),
    })
  } catch (error) {
    structuredLogger.error('hydrateFromSchemaBinding failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Minimal duration parser — mirrors the logic in hydration/topics.ts
function parseDuration(timeWindow: string): { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' } {
  const durationMatch = timeWindow.match(/^(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/)
  if (durationMatch) {
    const days = parseInt(durationMatch[1]?.replace('d', '') || '0') || 0
    const hours = parseInt(durationMatch[2]?.replace('h', '') || '0') || 0
    const minutes = parseInt(durationMatch[3]?.replace('m', '') || '0') || 0
    const seconds = parseInt(durationMatch[4]?.replace('s', '') || '0') || 0
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds
    if (totalSeconds >= 86400) return { value: Math.round(totalSeconds / 86400), unit: 'days' }
    if (totalSeconds >= 3600) return { value: Math.round(totalSeconds / 3600), unit: 'hours' }
    if (totalSeconds >= 60) return { value: Math.round(totalSeconds / 60), unit: 'minutes' }
    return { value: totalSeconds, unit: 'seconds' }
  }
  const simpleMatch = timeWindow.match(/^(\d+)([smhd])$/)
  if (simpleMatch) {
    const value = parseInt(simpleMatch[1]) || 1
    const map: Record<string, 'seconds' | 'minutes' | 'hours' | 'days'> = {
      s: 'seconds', m: 'minutes', h: 'hours', d: 'days',
    }
    return { value, unit: map[simpleMatch[2]] || 'hours' }
  }
  return { value: 1, unit: 'hours' }
}
