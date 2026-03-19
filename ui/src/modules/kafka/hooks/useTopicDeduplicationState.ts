import { useState, useCallback } from 'react'
import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export interface DeduplicationConfigState {
  key: string
  keyType: string
  window: number
  unit: string
}

export interface UseTopicDeduplicationStateParams {
  index: number
  enableDeduplication: boolean
  onDeduplicationChange?: (config: import('@/src/store/deduplication.store').DeduplicationConfig) => void
  initialDeduplicationConfig?: Partial<DeduplicationConfigState>
}

export function useTopicDeduplicationState({
  index,
  enableDeduplication,
  onDeduplicationChange,
  initialDeduplicationConfig,
}: UseTopicDeduplicationStateParams) {
  const { deduplicationStore } = useStore()
  const analytics = useJourneyAnalytics()

  const storedDeduplicationConfig = deduplicationStore.getDeduplication(index)
  const effectiveDeduplicationConfig = storedDeduplicationConfig

  const [deduplicationConfig, setDeduplicationConfig] = useState<DeduplicationConfigState>({
    key: initialDeduplicationConfig?.key ?? effectiveDeduplicationConfig?.key ?? '',
    keyType: initialDeduplicationConfig?.keyType ?? effectiveDeduplicationConfig?.keyType ?? 'string',
    window: initialDeduplicationConfig?.window ?? effectiveDeduplicationConfig?.window ?? 1,
    unit: initialDeduplicationConfig?.unit ?? effectiveDeduplicationConfig?.unit ?? 'hours',
  })

  const [deduplicationConfigured, setDeduplicationConfigured] = useState(
    !!(initialDeduplicationConfig?.key || (effectiveDeduplicationConfig?.key && effectiveDeduplicationConfig?.window)),
  )

  const configureDeduplication = useCallback(
    (newKeyConfig: { key: string; keyType: string }, newWindowConfig: { window: number; unit: string }) => {
      const updatedConfig: DeduplicationConfigState = {
        key: newKeyConfig.key,
        keyType: newKeyConfig.keyType,
        window: newWindowConfig.window,
        unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      }

      setDeduplicationConfig(updatedConfig)
      const isConfigured = !!(newKeyConfig.key && newWindowConfig.window)
      setDeduplicationConfigured(isConfigured)

      const config: import('@/src/store/deduplication.store').DeduplicationConfig = {
        enabled: isConfigured,
        key: updatedConfig.key,
        keyType: updatedConfig.keyType,
        window: updatedConfig.window,
        unit: updatedConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      }
      deduplicationStore.updateDeduplication(index, config)

      if (onDeduplicationChange) {
        onDeduplicationChange(config)
      }

      if (isConfigured) {
        analytics.key.dedupKey({
          keyType: newKeyConfig.keyType,
          window: newWindowConfig.window,
          unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
        })
      }
    },
    [index, deduplicationStore, onDeduplicationChange, analytics.key],
  )

  return {
    deduplicationConfig,
    deduplicationConfigured,
    storedDeduplicationConfig,
    configureDeduplication,
  }
}
