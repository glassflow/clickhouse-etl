import { notify } from './notify'
import { pipelineMessages, networkMessages, authMessages, serverMessages } from './messages'
import type { ApiError } from '@/src/types/pipeline'

export interface ApiErrorContext {
  operation: string
  pipelineName?: string
  retryFn?: () => void
  // Optional: Special handler for "must be stopped" errors (used for edit operations)
  onMustBeStopped?: () => void
}

/**
 * Centralized error handler for API calls
 * Maps API error codes and messages to appropriate user notifications
 */
export function handleApiError(error: unknown, context: ApiErrorContext) {
  const apiError = error as ApiError

  // Map API error codes to notifications
  if (apiError.code === 404) {
    if (context.operation === 'fetch' || context.operation === 'get') {
      notify(pipelineMessages.notFound(context.pipelineName || 'unknown'))
    } else {
      notify(pipelineMessages.notFound(context.pipelineName || 'unknown'))
    }
    return
  }

  if (apiError.code === 400) {
    const errorMessage = apiError.message || ''
    if (errorMessage.includes('must be stopped') || errorMessage.includes('Pipeline must be stopped')) {
      // Use special handler if provided (for edit operations that need to stop first)
      const stopHandler = context.onMustBeStopped || context.retryFn
      notify(pipelineMessages.mustBeStoppedForEdit(stopHandler))
    } else if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
      notify(pipelineMessages.renameFailed(context.retryFn))
    } else {
      // Generic 400 error
      notify({
        variant: 'error',
        title: 'Invalid request.',
        description: errorMessage || 'The request was invalid.',
        action: context.retryFn ? { label: 'Try again', onClick: context.retryFn } : undefined,
        reportLink: 'https://github.com/glassflow/clickhouse-etl/issues',
        channel: 'toast',
      })
    }
    return
  }

  if (apiError.code === 401) {
    notify(authMessages.unauthorized())
    return
  }

  if (apiError.code === 403) {
    notify(authMessages.forbidden())
    return
  }

  if (apiError.code === 429) {
    notify(networkMessages.rateLimitExceeded(context.retryFn))
    return
  }

  if (apiError.code === 500) {
    notify(serverMessages.internalServerError())
    return
  }

  if (apiError.code === 408 || apiError.message?.includes('timeout') || apiError.message?.includes('timed out')) {
    notify(networkMessages.requestTimeout(context.retryFn))
    return
  }

  // Generic error based on operation
  switch (context.operation) {
    case 'resume':
      notify(pipelineMessages.resumeFailed(context.pipelineName || ''))
      break
    case 'stop':
      notify(pipelineMessages.stopFailed(context.pipelineName || '', context.retryFn))
      break
    case 'delete':
      notify(pipelineMessages.deleteFailed(context.pipelineName || '', context.retryFn))
      break
    case 'terminate':
      notify(pipelineMessages.terminateFailed(context.pipelineName || ''))
      break
    case 'rename':
      notify(pipelineMessages.renameFailed(context.retryFn))
      break
    case 'edit':
      // For edit operations, use fetchFailed as fallback
      notify(pipelineMessages.fetchFailed(context.retryFn))
      break
    case 'fetch':
    case 'get':
      notify(pipelineMessages.fetchFailed(context.retryFn))
      break
    default:
      notify(networkMessages.networkError(context.retryFn))
  }
}
