import { PipelineStatus } from '@/src/types/pipeline'

export type PipelineStatusBadgeVariant = 'success' | 'warning' | 'secondary' | 'error' | 'default'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pausing: 'Pausing...',
  paused: 'Paused',
  resuming: 'Resuming...',
  stopping: 'Stopping...',
  stopped: 'Stopped',
  terminating: 'Terminating...',
  terminated: 'Terminated',
  failed: 'Failed',
}

/**
 * Returns the display label for a pipeline status (e.g. "Active", "Stopping...").
 */
export function getPipelineStatusLabel(status: PipelineStatus): string {
  return STATUS_LABELS[status] ?? 'Unknown status'
}

/**
 * Returns the Badge variant for a pipeline status (for consistent styling across list, mobile, etc.).
 */
export function getPipelineStatusVariant(status: PipelineStatus): PipelineStatusBadgeVariant {
  switch (status) {
    case 'active':
      return 'success'
    case 'paused':
    case 'pausing':
    case 'resuming':
    case 'stopping':
    case 'terminating':
      return 'warning'
    case 'stopped':
    case 'terminated':
      return 'secondary'
    case 'failed':
      return 'error'
    default:
      return 'default'
  }
}

/**
 * Returns a short accessibility-friendly description of the status (e.g. for title/tooltip).
 */
export function getPipelineStatusAccessibilityText(status: PipelineStatus): string {
  switch (status) {
    case 'active':
      return 'Pipeline is active'
    case 'pausing':
      return 'Pipeline is pausing'
    case 'paused':
      return 'Pipeline is paused'
    case 'resuming':
      return 'Pipeline is resuming'
    case 'stopping':
      return 'Pipeline is stopping'
    case 'stopped':
      return 'Pipeline is stopped'
    case 'terminating':
      return 'Pipeline is terminating'
    case 'terminated':
      return 'Pipeline is terminated'
    case 'failed':
      return 'Pipeline has failed'
    default:
      return 'Unknown status'
  }
}
