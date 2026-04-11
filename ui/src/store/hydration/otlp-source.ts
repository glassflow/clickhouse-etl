import { useStore } from '@/src/store'
import { SourceType } from '@/src/config/source-types'
import type { PipelineConfigForHydration } from '@/src/types/pipeline'

export function hydrateOtlpSource(config: PipelineConfigForHydration) {
  const state = useStore.getState()
  const sourceType = config.source?.type

  if (!sourceType || !sourceType.startsWith('otlp.')) return

  // Set source type on core store
  state.coreStore.setSourceType(sourceType)
  state.coreStore.setTopicCount(1)

  // Set OTLP store
  state.otlpStore.setSignalType(sourceType as SourceType)
  state.otlpStore.setSourceId(config.source?.id || '')

  // Set deduplication if present
  const dedup = config.source?.deduplication
  if (dedup) {
    state.otlpStore.setDeduplication({
      enabled: dedup.enabled || false,
      id_field: dedup.id_field || '',
      id_field_type: dedup.id_field_type || 'string',
      time_window: dedup.time_window || '5m',
    })
  }

  // Mark as valid since we're loading existing config
  state.otlpStore.markAsValid()
}
