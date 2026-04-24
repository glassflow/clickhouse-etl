// Wires cross-slice side effects via subscribe. Call wireCrossSliceEffects() once at app startup.
import { useStore } from './index'

let initialized = false

export function wireCrossSliceEffects(): () => void {
  if (initialized) return () => {}
  initialized = true
  const unsubscribe = useStore.subscribe(
    (s) => s.topicsStore.topics,
    (_topics, prev) => {
      if (prev === _topics) return
      const { joinStore, deduplicationStore } = useStore.getState()
      joinStore.setStreams([])
      // Invalidate deduplication for all configured topic indices
      const configuredIndices = Object.keys(deduplicationStore.deduplicationConfigs).map(Number)
      if (configuredIndices.length > 0) {
        configuredIndices.forEach((idx) => deduplicationStore.invalidateDeduplication(idx))
      }
    },
  )
  return unsubscribe
}
