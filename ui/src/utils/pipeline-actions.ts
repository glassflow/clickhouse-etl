import { Pipeline } from '@/src/types/pipeline'
import { PIPELINE_STATUS_MAP } from '@/src/config/constants'
import { PipelineAction } from '@/src/types/pipeline'

export interface ActionConfig {
  showModal: boolean
  requiresConfirmation: boolean
  warningMessage?: string
  disabledReason?: string
  isDisabled: boolean
}

/**
 * Determines if a pipeline action should show a modal, require confirmation, etc.
 * based on the current pipeline status
 */
export const getActionConfig = (action: PipelineAction, pipelineStatus: Pipeline['status']): ActionConfig => {
  const baseConfig: ActionConfig = {
    showModal: false,
    requiresConfirmation: false,
    isDisabled: false,
  }

  switch (action) {
    case 'edit':
      switch (pipelineStatus) {
        case PIPELINE_STATUS_MAP.active:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: true,
            warningMessage:
              'Editing an active pipeline will temporarily stop event processing while changes are applied. Do you want to continue?',
          }
        case PIPELINE_STATUS_MAP.paused:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: false,
          }
        case PIPELINE_STATUS_MAP.pausing:
        case PIPELINE_STATUS_MAP.stopping:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot edit pipeline while it's ${pipelineStatus}`,
          }
        case PIPELINE_STATUS_MAP.stopped:
        case PIPELINE_STATUS_MAP.failed:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot edit a ${pipelineStatus} pipeline`,
          }
        default:
          return baseConfig
      }

    case 'rename':
      switch (pipelineStatus) {
        case PIPELINE_STATUS_MAP.active:
        case PIPELINE_STATUS_MAP.paused:
        case PIPELINE_STATUS_MAP.failed:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: false,
          }
        case PIPELINE_STATUS_MAP.pausing:
        case PIPELINE_STATUS_MAP.stopping:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot rename pipeline while it's ${pipelineStatus}`,
          }
        case PIPELINE_STATUS_MAP.stopped:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot rename a ${pipelineStatus} pipeline`,
          }
        default:
          return baseConfig
      }

    case 'stop':
      switch (pipelineStatus) {
        case PIPELINE_STATUS_MAP.active:
        case PIPELINE_STATUS_MAP.paused:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: true,
            warningMessage:
              'This action will stop the pipeline. Choose whether to process remaining events in the queue (graceful) or stop immediately (ungraceful).',
          }
        case PIPELINE_STATUS_MAP.pausing:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: true,
            warningMessage:
              'The pipeline is currently pausing. This action will stop the pipeline. Choose whether to process remaining events in the queue (graceful) or stop immediately (ungraceful).',
          }
        case PIPELINE_STATUS_MAP.stopping:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: 'Pipeline is already being stopped',
          }
        case PIPELINE_STATUS_MAP.stopped:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: 'Pipeline is already stopped',
          }
        case PIPELINE_STATUS_MAP.failed:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: false,
          }
        default:
          return baseConfig
      }

    case 'delete':
      switch (pipelineStatus) {
        case PIPELINE_STATUS_MAP.stopped:
          return {
            ...baseConfig,
            showModal: false,
            requiresConfirmation: false,
          }
        case PIPELINE_STATUS_MAP.active:
        case PIPELINE_STATUS_MAP.paused:
        case PIPELINE_STATUS_MAP.pausing:
        case PIPELINE_STATUS_MAP.stopping:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot delete pipeline while it's ${pipelineStatus}. Stop the pipeline first.`,
          }
        case PIPELINE_STATUS_MAP.failed:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot delete pipeline in ${pipelineStatus} state. Pipeline must be stopped first.`,
          }
        default:
          return baseConfig
      }

    case 'pause':
      switch (pipelineStatus) {
        case PIPELINE_STATUS_MAP.active:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: false,
          }
        case PIPELINE_STATUS_MAP.paused:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: 'Pipeline is already paused',
          }
        case PIPELINE_STATUS_MAP.pausing:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: 'Pipeline is already being paused',
          }
        case PIPELINE_STATUS_MAP.resuming:
        case PIPELINE_STATUS_MAP.stopping:
        case PIPELINE_STATUS_MAP.stopped:
        case PIPELINE_STATUS_MAP.failed:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot pause a ${pipelineStatus} pipeline`,
          }
        default:
          return baseConfig
      }

    case 'resume':
      switch (pipelineStatus) {
        case PIPELINE_STATUS_MAP.paused:
          return {
            ...baseConfig,
            showModal: false,
            requiresConfirmation: false,
          }
        case PIPELINE_STATUS_MAP.active:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: 'Pipeline is already active',
          }
        case PIPELINE_STATUS_MAP.resuming:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: 'Pipeline is already being resumed',
          }
        case PIPELINE_STATUS_MAP.pausing:
        case PIPELINE_STATUS_MAP.stopping:
        case PIPELINE_STATUS_MAP.stopped:
        case PIPELINE_STATUS_MAP.failed:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot resume a ${pipelineStatus} pipeline`,
          }
        default:
          return baseConfig
      }

    default:
      return baseConfig
  }
}

/**
 * Determines which actions are available for a given pipeline status
 */
export const getAvailableActions = (pipelineStatus: Pipeline['status']): PipelineAction[] => {
  const allActions: PipelineAction[] = ['edit', 'rename', 'stop', 'delete', 'pause', 'resume']

  return allActions.filter((action) => {
    const config = getActionConfig(action, pipelineStatus)
    return !config.isDisabled
  })
}

/**
 * Gets the appropriate action button text based on pipeline status
 */
export const getActionButtonText = (action: PipelineAction, pipelineStatus: Pipeline['status']): string => {
  switch (action) {
    case 'pause':
      return pipelineStatus === PIPELINE_STATUS_MAP.pausing ? 'Pausing...' : 'Pause'
    case 'resume':
      return pipelineStatus === PIPELINE_STATUS_MAP.resuming ? 'Resuming...' : 'Resume'
    case 'stop':
      return pipelineStatus === PIPELINE_STATUS_MAP.stopping ? 'Stopping...' : 'Stop'
    case 'delete':
      return 'Delete'
    case 'edit':
      return 'Edit'
    case 'rename':
      return 'Rename'
  }
}

export const shouldDisablePipelineOperation = (pipelineStatus: Pipeline['status']): boolean => {
  // Only disable operations for truly inaccessible states
  return (
    pipelineStatus === PIPELINE_STATUS_MAP.stopped ||
    pipelineStatus === PIPELINE_STATUS_MAP.stopping ||
    pipelineStatus === PIPELINE_STATUS_MAP.failed
  )
}

/**
 * Determines if a pipeline blocks new pipeline creation based on its status.
 * Only active and paused pipelines block new pipeline creation.
 * Stopped or failed pipelines allow new pipeline creation.
 */
export const countPipelinesBlockingCreation = (pipelines: Array<{ status?: string }>): number => {
  return pipelines.filter(
    (pipeline) =>
      pipeline.status === PIPELINE_STATUS_MAP.active ||
      pipeline.status === PIPELINE_STATUS_MAP.paused ||
      pipeline.status === PIPELINE_STATUS_MAP.pausing ||
      pipeline.status === PIPELINE_STATUS_MAP.stopping,
  ).length
}
