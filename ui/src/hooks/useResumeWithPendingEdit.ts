/**
 * Hook for handling the "resume with pending edit" flow.
 *
 * When a user has unsaved changes (isDirty) and clicks "Resume", we need to:
 * 1. Generate the API config from current store state
 * 2. Send an edit request to the backend (backend auto-resumes after edit)
 * 3. Mark stores as clean
 * 4. Fetch the updated pipeline from backend
 * 5. Reset stores and clear hydration cache
 * 6. Update the pipeline prop to trigger re-hydration
 *
 * This logic was previously embedded in PipelineDetailsHeader (~50 lines).
 * Extracting it makes the header simpler and the flow testable.
 */

import { useCallback } from 'react'
import { useStore } from '@/src/store'
import { getPipeline } from '@/src/api/pipeline-api'
import type { Pipeline } from '@/src/types/pipeline'

const HYDRATION_CACHE_KEY = 'lastHydratedPipeline'

export interface UseResumeWithPendingEditOptions {
  /** The current pipeline being edited */
  pipeline: Pipeline
  /** Callback to execute the edit action */
  executeEditAction: (apiConfig: any) => Promise<any>
  /** Callback to update the pipeline in parent component */
  onPipelineUpdate?: (pipeline: Pipeline) => void
}

export interface UseResumeWithPendingEditResult {
  /**
   * Check if there are pending edits that need to be saved before resume.
   */
  hasPendingEdits: () => boolean

  /**
   * Execute the resume-with-pending-edit flow.
   * Returns true if the flow was executed, false if there were no pending edits.
   */
  resumeWithPendingEdit: () => Promise<boolean>
}

/**
 * Hook for handling resume with unsaved changes.
 *
 * @example
 * ```tsx
 * const { hasPendingEdits, resumeWithPendingEdit } = useResumeWithPendingEdit({
 *   pipeline,
 *   executeEditAction: (config) => executeAction('edit', config),
 *   onPipelineUpdate,
 * })
 *
 * const handleResume = async () => {
 *   if (hasPendingEdits()) {
 *     await resumeWithPendingEdit()
 *     // Backend auto-resumes after edit, so we're done
 *   } else {
 *     // Normal resume flow
 *     await executeAction('resume')
 *   }
 * }
 * ```
 */
export function useResumeWithPendingEdit(
  options: UseResumeWithPendingEditOptions
): UseResumeWithPendingEditResult {
  const { pipeline, executeEditAction, onPipelineUpdate } = options

  /**
   * Check if there are unsaved changes in the core store.
   */
  const hasPendingEdits = useCallback((): boolean => {
    const { coreStore } = useStore.getState()
    return coreStore.isDirty
  }, [])

  /**
   * Execute the resume-with-pending-edit flow.
   */
  const resumeWithPendingEdit = useCallback(async (): Promise<boolean> => {
    const { coreStore } = useStore.getState()

    if (!coreStore.isDirty) {
      return false // No pending edits
    }

    // Dynamically import generateApiConfig to avoid circular dependencies
    const { generateApiConfig } = await import('@/src/modules/clickhouse/utils')

    // Get all store states needed for generating the API config
    const {
      kafkaStore,
      topicsStore,
      clickhouseConnectionStore,
      clickhouseDestinationStore,
      joinStore,
      deduplicationStore,
      filterStore,
      transformationStore,
    } = useStore.getState()

    // Generate the API configuration
    const apiConfig = generateApiConfig({
      pipelineId: coreStore.pipelineId,
      pipelineName: coreStore.pipelineName,
      setPipelineId: coreStore.setPipelineId,
      clickhouseConnection: clickhouseConnectionStore.clickhouseConnection,
      clickhouseDestination: clickhouseDestinationStore.clickhouseDestination,
      selectedTopics: Object.values(topicsStore.topics || {}),
      getMappingType: (eventField: string, mapping: any) => {
        const mappingEntry = mapping.find((m: any) => m.eventField === eventField)
        if (mappingEntry) {
          return mappingEntry.jsonType
        }
        return 'string'
      },
      joinStore,
      kafkaStore,
      deduplicationStore,
      filterStore,
      transformationStore,
      version: coreStore.pipelineVersion, // Respect the original pipeline version
    })

    // Send edit request to backend (backend will automatically resume after edit)
    await executeEditAction(apiConfig)

    // Mark as clean after successful edit
    coreStore.markAsClean()

    // Fetch the updated pipeline configuration from the backend
    const updatedPipeline = await getPipeline(pipeline.pipeline_id)

    // Clear the hydration cache so the pipeline re-hydrates with fresh data
    sessionStorage.removeItem(HYDRATION_CACHE_KEY)

    // Reset all relevant stores to force complete re-hydration
    const {
      topicsStore: currentTopicsStore,
      deduplicationStore: currentDeduplicationStore,
      joinStore: currentJoinStore,
      coreStore: currentCoreStore,
    } = useStore.getState()

    // Reset all stores that depend on pipeline configuration
    currentTopicsStore.resetTopicsStore()
    currentDeduplicationStore.resetDeduplicationStore()
    currentJoinStore.resetJoinStore()

    // CRITICAL: Reset mode to 'view' to allow re-hydration on next edit
    // Without this, the mode stays 'edit' and blocks hydration in PipelineDetailsModule
    currentCoreStore.setMode('view')

    // Update the local pipeline state with the fresh configuration
    // This will trigger re-hydration in PipelineDetailsModule
    if (onPipelineUpdate) {
      onPipelineUpdate(updatedPipeline)
    }

    return true
  }, [pipeline.pipeline_id, executeEditAction, onPipelineUpdate])

  return {
    hasPendingEdits,
    resumeWithPendingEdit,
  }
}
