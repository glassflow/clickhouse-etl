import { useState } from 'react'
import { Pipeline } from '@/src/types/pipeline'
import { pausePipeline, resumePipeline, deletePipeline, renamePipeline, updatePipeline } from '@/src/api/pipeline-api'
import { getActionConfig, getActionButtonText, getAvailableActions } from '@/src/utils/pipeline-actions'
import { PipelineAction } from '@/src/types/pipeline'

export interface PipelineActionState {
  isLoading: boolean
  error: string | null
  lastAction: PipelineAction | null
}

export const usePipelineActions = (pipeline: Pipeline) => {
  const [actionState, setActionState] = useState<PipelineActionState>({
    isLoading: false,
    error: null,
    lastAction: null,
  })

  const executeAction = async (action: PipelineAction, payload?: any): Promise<Pipeline | void> => {
    setActionState({
      isLoading: true,
      error: null,
      lastAction: action,
    })

    try {
      let result: Pipeline | void

      switch (action) {
        case 'pause':
          result = await pausePipeline(pipeline.id)
          break

        case 'resume':
          result = await resumePipeline(pipeline.id)
          break

        case 'delete':
          const isGraceful = payload?.graceful || false
          await deletePipeline(pipeline.id, isGraceful)
          result = undefined
          break

        case 'rename':
          if (!payload?.name) {
            throw new Error('New name is required for rename action')
          }
          result = await renamePipeline(pipeline.id, payload.name)
          break

        case 'edit':
          // For edit action in pipeline details, we don't make an immediate API call
          // The actual editing happens through the UI components
          // This action just confirms the user wants to proceed with editing
          console.log('Edit action confirmed for pipeline:', pipeline.id)
          result = pipeline // Return the current pipeline as no immediate update is needed
          break

        default:
          throw new Error(`Unsupported action: ${action}`)
      }

      setActionState({
        isLoading: false,
        error: null,
        lastAction: action,
      })

      return result
    } catch (error: any) {
      setActionState({
        isLoading: false,
        error: error.message || `Failed to ${action} pipeline`,
        lastAction: action,
      })
      throw error
    }
  }

  const getActionConfiguration = (action: PipelineAction) => {
    return getActionConfig(action, pipeline.status)
  }

  const getButtonText = (action: PipelineAction) => {
    return getActionButtonText(action, pipeline.status)
  }

  const getAvailableActionsForPipeline = () => {
    return getAvailableActions(pipeline.status)
  }

  const isActionDisabled = (action: PipelineAction) => {
    const config = getActionConfig(action, pipeline.status)
    return config.isDisabled || actionState.isLoading
  }

  const shouldShowModal = (action: PipelineAction) => {
    const config = getActionConfig(action, pipeline.status)
    return config.showModal
  }

  const clearError = () => {
    setActionState((prev) => ({ ...prev, error: null }))
  }

  return {
    // State
    actionState,

    // Actions
    executeAction,
    clearError,

    // Helpers
    getActionConfiguration,
    getButtonText,
    getAvailableActionsForPipeline,
    isActionDisabled,
    shouldShowModal,
  }
}
