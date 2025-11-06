import type { NotificationOptions } from '../types'
import { DEFAULT_REPORT_LINK, refreshAction } from './constants'

export const pipelineMessages = {
  /**
   * Pipeline not found
   * Happens when user tries to visit the pipeline details page for the pipeline that does not exist
   */
  notFound: (name: string): NotificationOptions => ({
    variant: 'info',
    title: 'Pipeline not found.',
    description: `The pipeline "${name}" may have been deleted or is unavailable.`,
    action: refreshAction,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to fetch pipelines
   * Pipeline list page - failed to get the list of available pipelines
   */
  fetchFailed: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Unable to load pipelines.',
    description: 'The list could not be fetched.',
    action: retryFn ? { label: 'Check your connection and try again', onClick: retryFn } : refreshAction,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to resume pipeline
   * Pipeline Details Page/Pipeline List context menu - Resume failed
   */
  resumeFailed: (pipelineName: string): NotificationOptions => ({
    variant: 'error',
    title: `Failed to resume pipeline ${pipelineName}.`,
    description: 'The operation could not complete.',
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to stop pipeline
   * Pipeline Details Page/Pipeline List context menu - Stop failed
   */
  stopFailed: (pipelineName: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: `Failed to stop pipeline ${pipelineName}.`,
    description: 'The request could not complete.',
    action: retryFn ? { label: 'Refresh the pipeline status and try again', onClick: retryFn } : refreshAction,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to terminate pipeline
   * Pipeline Details Page/Pipeline List context menu - Terminate failed
   */
  terminateFailed: (pipelineName: string): NotificationOptions => ({
    variant: 'error',
    title: `Failed to terminate pipeline ${pipelineName}.`,
    description: 'It might be an error on backend or logic limitation.',
    action: undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to delete pipeline
   * Pipeline Details Page/Pipeline List context menu - Delete failed
   */
  deleteFailed: (pipelineName: string, retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: `Failed to delete pipeline ${pipelineName}.`,
    description: 'It might be an error on backend or logic limitation.',
    action: retryFn ? { label: "Ensure it's stopped first and try again", onClick: retryFn } : undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Failed to rename pipeline
   * Pipeline Details Page/Pipeline List context menu - Rename failed
   */
  renameFailed: (retryFn?: () => void): NotificationOptions => ({
    variant: 'error',
    title: 'Unable to rename pipeline.',
    description: 'The new name may be invalid or already in use.',
    action: retryFn ? { label: 'Enter a valid, unique name and try again', onClick: retryFn } : undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Pipeline must be stopped for edit
   * Regular info, conveyed through modal, when user tries to edit the pipeline
   */
  mustBeStoppedForEdit: (stopFn?: () => void): NotificationOptions => ({
    variant: 'info',
    title: 'Pipeline must be stopped before editing.',
    description: 'Edits are only allowed on paused pipelines.',
    action: stopFn ? { label: 'Stop or pause the pipeline, then edit again', onClick: stopFn } : undefined,
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'modal',
  }),

  /**
   * Invalid status transition
   * Fallback, should not happen at all (should be prevented on the UI)
   */
  invalidStatusTransition: (action: string, currentState: string): NotificationOptions => ({
    variant: 'info',
    title: 'Invalid action.',
    description: `Cannot perform ${action} while pipeline is ${currentState}.`,
    action: { label: 'Check the status and choose a valid action', onClick: () => {} },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Pipeline in transition state
   * Should not happen, it should be prevented by UI
   */
  inTransition: (transitioning: string): NotificationOptions => ({
    variant: 'info',
    title: 'Pipeline is transitioning.',
    description: `The pipeline is currently ${transitioning}.`,
    action: { label: 'Wait until the transition completes', onClick: () => {} },
    reportLink: DEFAULT_REPORT_LINK,
    channel: 'toast',
  }),

  /**
   * Pipeline already in target state
   */
  alreadyInTargetState: (state: string): NotificationOptions => ({
    variant: 'info',
    title: 'Pipeline already in target state.',
    description: `The pipeline is ${state}.`,
    action: undefined,
    reportLink: undefined,
    channel: 'toast',
  }),
}
