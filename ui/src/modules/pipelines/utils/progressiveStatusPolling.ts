/**
 * Progressive Status Polling Utility
 *
 * Provides smart polling for long-running pipeline operations with progressive intervals:
 * - Minute 1: every 2s (frequent checks for quick operations)
 * - Minute 2: every 5s (moderate frequency)
 * - Minute 3: every 10s (reduced frequency)
 * - Minute 4: every 15s (longer intervals)
 * - Minutes 5-30: every 30s (minimal polling for heavy operations)
 */

export interface ProgressivePollingOptions {
  /** Function to call for each status check */
  onCheck: () => Promise<void>
  /** Maximum duration to poll in minutes (default: 30) */
  maxDurationMinutes?: number
  /** Operation name for logging (default: 'operation') */
  operationName?: string
  /** Pipeline ID for logging */
  pipelineId: string
  /** Callback when polling stops due to timeout */
  onTimeout?: () => void
}

export interface ProgressivePollingController {
  /** Stop the polling manually */
  stop: () => void
  /** Check if polling is currently active */
  isActive: () => boolean
}

/**
 * Starts progressive polling for pipeline status updates
 */
export function startProgressiveStatusPolling(options: ProgressivePollingOptions): ProgressivePollingController {
  const { onCheck, maxDurationMinutes = 30, operationName = 'operation', pipelineId, onTimeout } = options

  let elapsedTime = 0 // in seconds
  const maxDuration = maxDurationMinutes * 60 // convert to seconds
  let isPollingActive = true
  let currentTimeoutId: NodeJS.Timeout | null = null

  const getNextInterval = (elapsed: number): number => {
    if (elapsed < 60) {
      return 2000 // First minute: every 2 seconds
    } else if (elapsed < 120) {
      return 5000 // Second minute: every 5 seconds
    } else if (elapsed < 180) {
      return 10000 // Third minute: every 10 seconds
    } else if (elapsed < 240) {
      return 15000 // Fourth minute: every 15 seconds
    } else {
      return 30000 // Minutes 5-30: every 30 seconds
    }
  }

  const scheduleNextCheck = () => {
    if (!isPollingActive) {
      return
    }

    const nextInterval = getNextInterval(elapsedTime)

    currentTimeoutId = setTimeout(async () => {
      if (!isPollingActive) {
        return
      }

      elapsedTime += nextInterval / 1000

      if (elapsedTime >= maxDuration) {
        console.log(
          `Stopped checking ${operationName} status after ${maxDurationMinutes} minutes - pipeline may still be processing`,
          { pipelineId },
        )
        isPollingActive = false
        onTimeout?.()
        return
      }

      const minutes = Math.floor(elapsedTime / 60)
      const seconds = Math.floor(elapsedTime % 60)
      const nextCheckSeconds = nextInterval / 1000

      console.log(
        `Checking ${operationName} completion (elapsed: ${minutes}m ${seconds}s, next check in ${nextCheckSeconds}s)`,
        { pipelineId },
      )

      try {
        await onCheck()
      } catch (error) {
        console.error(`Failed to check ${operationName} completion:`, error, { pipelineId })
      }

      // Schedule next check with potentially different interval
      scheduleNextCheck()
    }, nextInterval)
  }

  // Start the progressive polling
  console.log(`Starting progressive ${operationName} status polling`, { pipelineId, maxDurationMinutes })
  scheduleNextCheck()

  return {
    stop: () => {
      isPollingActive = false
      if (currentTimeoutId) {
        clearTimeout(currentTimeoutId)
        currentTimeoutId = null
      }
      console.log(`Stopped ${operationName} status polling`, { pipelineId })
    },
    isActive: () => isPollingActive,
  }
}

/**
 * Utility function specifically for pause operations
 */
export function startPauseStatusPolling(
  pipelineId: string,
  onRefresh: () => Promise<void>,
  onTimeout?: () => void,
): ProgressivePollingController {
  return startProgressiveStatusPolling({
    pipelineId,
    operationName: 'pause',
    onCheck: onRefresh,
    maxDurationMinutes: 30,
    onTimeout,
  })
}

/**
 * Utility function for other long-running operations
 */
export function startOperationStatusPolling(
  pipelineId: string,
  operationName: string,
  onRefresh: () => Promise<void>,
  maxDurationMinutes: number = 30,
  onTimeout?: () => void,
): ProgressivePollingController {
  return startProgressiveStatusPolling({
    pipelineId,
    operationName,
    onCheck: onRefresh,
    maxDurationMinutes,
    onTimeout,
  })
}
