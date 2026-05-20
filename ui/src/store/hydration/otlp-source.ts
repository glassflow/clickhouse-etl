import { useStore } from '@/src/store'
import { SourceType } from '@/src/config/source-types'
import type { PipelineConfigForHydration } from '@/src/types/pipeline'

export function hydrateOtlpSource(config: PipelineConfigForHydration) {
  const state = useStore.getState()
  const cfg = config as any

  // Handle both internal format (config.source.type) and v3 wire format (config.sources[0].type)
  const sourceType = config.source?.type ?? cfg.sources?.[0]?.type
  const sourceId = config.source?.id ?? cfg.sources?.[0]?.source_id

  if (!sourceType || !sourceType.startsWith('otlp.')) return

  // Set source type on core store
  state.coreStore.setSourceType(sourceType)
  state.coreStore.setTopicCount(1)

  // Set OTLP store
  state.otlpStore.setSignalType(sourceType as SourceType)
  state.otlpStore.setSourceId(sourceId || '')

  // Set deduplication if present.
  // Backend V3 wire format uses `key`; fall back to `id_field` for any legacy configs.
  const dedup = config.source?.deduplication
  if (dedup) {
    state.otlpStore.setDeduplication({
      enabled: dedup.enabled || false,
      key: (dedup as any).key || (dedup as any).id_field || '',
      time_window: dedup.time_window || '5m',
    })
  }

  // Mark as valid since we're loading existing config
  state.otlpStore.markAsValid()
}
