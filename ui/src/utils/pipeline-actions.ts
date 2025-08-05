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
        case PIPELINE_STATUS_MAP.deleting:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot edit pipeline while it's ${pipelineStatus}`,
          }
        case PIPELINE_STATUS_MAP.deleted:
        case PIPELINE_STATUS_MAP.error:
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
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: false,
          }
        case PIPELINE_STATUS_MAP.pausing:
        case PIPELINE_STATUS_MAP.deleting:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot rename pipeline while it's ${pipelineStatus}`,
          }
        case PIPELINE_STATUS_MAP.deleted:
        case PIPELINE_STATUS_MAP.error:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: `Cannot rename a ${pipelineStatus} pipeline`,
          }
        default:
          return baseConfig
      }

    case 'delete':
      switch (pipelineStatus) {
        case PIPELINE_STATUS_MAP.active:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: true,
            warningMessage:
              'This action will permanently delete the pipeline and all its configuration. Choose how to handle events currently in the queue.',
          }
        case PIPELINE_STATUS_MAP.paused:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: true,
            warningMessage: 'This action will permanently delete the pipeline and all its configuration.',
          }
        case PIPELINE_STATUS_MAP.pausing:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: true,
            warningMessage:
              'The pipeline is currently pausing. This action will permanently delete the pipeline and all its configuration.',
          }
        case PIPELINE_STATUS_MAP.deleting:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: 'Pipeline is already being deleted',
          }
        case PIPELINE_STATUS_MAP.error:
          return {
            ...baseConfig,
            showModal: true,
            requiresConfirmation: false,
          }
        case PIPELINE_STATUS_MAP.deleted:
          return {
            ...baseConfig,
            isDisabled: true,
            disabledReason: 'Pipeline is already deleted',
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
            requiresConfirmation: true,
            warningMessage:
              'Pausing will stop consuming new events from Kafka, but will process events already in the queue. This may take some time.',
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
            disabledReason: 'Pipeline is currently pausing',
          }
        case PIPELINE_STATUS_MAP.deleting:
        case PIPELINE_STATUS_MAP.deleted:
        case PIPELINE_STATUS_MAP.error:
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
        case PIPELINE_STATUS_MAP.pausing:
        case PIPELINE_STATUS_MAP.deleting:
        case PIPELINE_STATUS_MAP.deleted:
        case PIPELINE_STATUS_MAP.error:
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
  const allActions: PipelineAction[] = ['edit', 'rename', 'delete', 'pause', 'resume']

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
      return 'Start'
    case 'delete':
      return pipelineStatus === PIPELINE_STATUS_MAP.deleting ? 'Deleting...' : 'Delete'
    case 'edit':
      return 'Edit'
    case 'rename':
      return 'Rename'
  }
}

export const shouldDisablePipelineOperation = (pipelineStatus: Pipeline['status']): boolean => {
  return pipelineStatus !== PIPELINE_STATUS_MAP.paused && pipelineStatus !== PIPELINE_STATUS_MAP.active
}
