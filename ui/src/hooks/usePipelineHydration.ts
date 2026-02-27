/**
 * Hook for hydrating pipeline data into the stores.
 *
 * Centralizes the complex hydration logic that was previously in PipelineDetailsModule.
 * Handles:
 * - Skip conditions (dirty state, edit mode, loading)
 * - Session storage cache for avoiding unnecessary re-hydration
 * - Store verification (topics, event data)
 * - Adapter-based hydration (v1/v2 pipeline versions)
 *
 * The hook is designed to be testable by:
 * - Extracting cache key generation
 * - Extracting store verification
 * - Making the hydration logic a pure function where possible
 */

import { useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/src/store'
import { getPipelineAdapter } from '@/src/modules/pipeline-adapters/factory'
import type { Pipeline } from '@/src/types/pipeline'
import { structuredLogger } from '@/src/observability'

const HYDRATION_CACHE_KEY = 'lastHydratedPipeline'

export interface UsePipelineHydrationOptions {
  /**
   * Whether pipeline actions are currently loading.
   * When true, hydration is skipped to avoid race conditions.
   */
  isActionLoading?: boolean
}

export interface UsePipelineHydrationResult {
  /**
   * Manually clear the hydration cache.
   * Useful when resuming with pending edits.
   */
  clearHydrationCache: () => void
}

/**
 * Generates a cache key for the pipeline to detect configuration changes.
 * The key includes all relevant pipeline properties that would require re-hydration.
 */
export function generateHydrationCacheKey(pipeline: Pipeline): string {
  const topicNames = pipeline.source?.topics?.map((t: any) => t.name).join(',') || ''
  return `${pipeline.pipeline_id}-${pipeline.name}-${pipeline.status}-${topicNames}-${pipeline.version || 'v1'}`
}

/**
 * Verifies that the stores have valid data for the pipeline.
 * Returns true if stores are properly populated and no re-hydration is needed.
 */
export function verifyStoreData(): { hasValidData: boolean; reason?: string } {
  const { topicsStore } = useStore.getState()
  const hasTopics = topicsStore.topics && Object.keys(topicsStore.topics).length > 0

  if (!hasTopics) {
    return { hasValidData: false, reason: 'no-topics' }
  }

  // Also verify that topics have event data
  // Without event data, ClickHouse mapping won't have fields to display
  const topicsHaveEventData = Object.values(topicsStore.topics).every(
    (topic: any) => topic?.selectedEvent?.event !== undefined
  )

  if (!topicsHaveEventData) {
    return { hasValidData: false, reason: 'no-event-data' }
  }

  return { hasValidData: true }
}

/**
 * Hook for hydrating pipeline data into the application stores.
 *
 * @param pipeline - The pipeline data to hydrate
 * @param options - Optional configuration
 * @returns Hydration utilities
 *
 * @example
 * ```tsx
 * const { clearHydrationCache } = usePipelineHydration(pipeline, {
 *   isActionLoading: actionState.isLoading,
 * })
 *
 * // When resuming with pending edits, clear the cache
 * const handleResumeWithEdit = () => {
 *   clearHydrationCache()
 *   // ... rest of resume logic
 * }
 * ```
 */
export function usePipelineHydration(
  pipeline: Pipeline | null,
  options: UsePipelineHydrationOptions = {}
): UsePipelineHydrationResult {
  const { isActionLoading = false } = options

  const { coreStore } = useStore()
  const { enterViewMode, mode } = coreStore

  // Track if hydration has been attempted to prevent duplicate runs
  const hydrationAttemptedRef = useRef(false)

  const clearHydrationCache = useCallback(() => {
    sessionStorage.removeItem(HYDRATION_CACHE_KEY)
  }, [])

  useEffect(() => {
    const hydrateData = async () => {
      // CRITICAL: Don't hydrate if there are unsaved changes or if we're in edit mode
      // This prevents overwriting user changes with stale backend data
      const { coreStore: currentCoreStore } = useStore.getState()

      if (currentCoreStore.isDirty) {
        structuredLogger.debug('usePipelineHydration skipping hydration - dirty config present')
        return
      }

      // Validate pipeline has required data for hydration
      if (!pipeline || !pipeline.source || !pipeline.sink) {
        return
      }

      // Skip during action loading to avoid race conditions
      if (isActionLoading) {
        return
      }

      // Skip if in edit mode
      if (mode === 'edit') {
        return
      }

      // Generate cache key and check if already hydrated
      const currentPipelineKey = generateHydrationCacheKey(pipeline)
      const lastHydratedKey = sessionStorage.getItem(HYDRATION_CACHE_KEY)

      // Check if cache says we're hydrated, but also verify stores actually have data
      // After a page reload, sessionStorage persists but Zustand stores are empty
      if (lastHydratedKey === currentPipelineKey) {
        const { hasValidData, reason } = verifyStoreData()

        if (hasValidData) {
          // Already hydrated with valid data, skip
          return
        } else {
          // Clear the stale cache and proceed with hydration
          structuredLogger.debug('usePipelineHydration cache hit but invalid store data, re-hydrating', { reason })
          sessionStorage.removeItem(HYDRATION_CACHE_KEY)
        }
      }

      try {
        // 1. Detect version and get appropriate adapter
        const adapter = getPipelineAdapter(pipeline.version || 'v1')

        // 2. Hydrate raw API config into InternalPipelineConfig
        // Pipeline at this boundary is an API response that might differ in structure
        const internalConfig = adapter.hydrate(pipeline)

        // 3. Pass internal config to store
        await enterViewMode(internalConfig)

        // 4. Mark as hydrated to prevent re-hydration
        sessionStorage.setItem(HYDRATION_CACHE_KEY, currentPipelineKey)

        structuredLogger.info('usePipelineHydration successfully hydrated pipeline', { pipeline_id: pipeline.pipeline_id })
      } catch (error) {
        structuredLogger.error('usePipelineHydration failed to hydrate pipeline data', { error: error instanceof Error ? error.message : String(error) })
        // Error will be handled by the stores' validation states
      }
    }

    hydrateData()
    // NOTE: We intentionally don't include mode changes frequently
    // The sessionStorage cache and pipeline key handle detecting real config changes
    // We check isDirty directly in the function rather than as a dependency to avoid loops
  }, [pipeline, enterViewMode, mode, isActionLoading])

  return {
    clearHydrationCache,
  }
}
