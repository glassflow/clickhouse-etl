/**
 * Hook for computing pipeline display status information.
 *
 * Centralizes the logic for determining what status to display in the UI,
 * combining information from:
 * - Centralized pipeline state (SSE)
 * - Health monitoring data
 * - Recent action tracking
 * - Loading states
 *
 * Previously this logic was duplicated in getStatusVariant and getBadgeLabel
 * functions in PipelineDetailsHeader.
 */

import { useRef, useMemo } from 'react'
import { PipelineStatus, parsePipelineStatus } from '@/src/types/pipeline'
import type { PipelineHealth } from '@/src/api/pipeline-health'

export type StatusVariant = 'success' | 'warning' | 'secondary' | 'error' | 'default'

export interface PipelineDisplayStatus {
  /** The effective status to display */
  displayStatus: PipelineStatus
  /** Badge variant for styling */
  variant: StatusVariant
  /** Human-readable label for the status */
  label: string
  /** Whether health data is being loaded */
  isHealthLoading: boolean
}

export interface UsePipelineDisplayStatusOptions {
  /** Status from the pipeline prop */
  pipelineStatus: PipelineStatus | string | undefined
  /** Status from centralized state (SSE) */
  centralizedStatus: PipelineStatus | null
  /** Health data from health monitoring */
  health: PipelineHealth | null
  /** Whether health data is loading */
  healthLoading: boolean
  /** Whether an action is currently loading */
  isActionLoading: boolean
  /** The last action that was executed */
  lastAction: string | null | undefined
}

/**
 * Maps a pipeline status to a badge variant.
 */
function getVariantForStatus(status: PipelineStatus): StatusVariant {
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
 * Maps a pipeline status to a human-readable label.
 */
function getLabelForStatus(status: PipelineStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'pausing':
      return 'Pausing...'
    case 'paused':
      return 'Paused'
    case 'resuming':
      return 'Resuming...'
    case 'stopping':
      return 'Stopping...'
    case 'stopped':
      return 'Stopped'
    case 'terminating':
      return 'Terminating...'
    case 'terminated':
      return 'Terminated'
    case 'failed':
      return 'Failed'
    default:
      return 'Unknown status'
  }
}

// Time window for considering an action as "recent" (5 seconds)
const RECENT_ACTION_THRESHOLD_MS = 5000

/**
 * Hook for computing pipeline display status.
 *
 * @example
 * ```tsx
 * const { displayStatus, variant, label, isHealthLoading } = usePipelineDisplayStatus({
 *   pipelineStatus: pipeline.status,
 *   centralizedStatus,
 *   health,
 *   healthLoading,
 *   isActionLoading: actionState.isLoading,
 *   lastAction: actionState.lastAction,
 * })
 *
 * return (
 *   <Badge variant={variant}>
 *     {isHealthLoading && !centralizedStatus ? 'Checking...' : label}
 *   </Badge>
 * )
 * ```
 */
export function usePipelineDisplayStatus(
  options: UsePipelineDisplayStatusOptions
): PipelineDisplayStatus {
  const {
    pipelineStatus,
    centralizedStatus,
    health,
    healthLoading,
    isActionLoading,
    lastAction,
  } = options

  // Track recent actions for health monitoring coordination
  const recentActionRef = useRef<{ action: string; timestamp: number } | null>(null)

  // Update recent action tracking when lastAction changes
  if (lastAction && (!recentActionRef.current || recentActionRef.current.action !== lastAction)) {
    recentActionRef.current = { action: lastAction, timestamp: Date.now() }
  }

  const result = useMemo(() => {
    // Use centralized status if available, otherwise fall back to pipeline prop
    let displayStatus: PipelineStatus = centralizedStatus || (pipelineStatus as PipelineStatus) || 'active'

    // Check if there's a recent action that should override health status
    const recentAction = recentActionRef.current
    const isRecentAction = recentAction && Date.now() - recentAction.timestamp < RECENT_ACTION_THRESHOLD_MS

    // Only use health data if:
    // - No centralized status is available
    // - Health data exists
    // - No action is currently loading
    // - No recent action was performed
    // - Pipeline status is generic ('active', empty, or 'no_configuration')
    if (
      !centralizedStatus &&
      health?.overall_status &&
      !isActionLoading &&
      !isRecentAction &&
      (pipelineStatus === 'active' || !pipelineStatus || pipelineStatus === 'no_configuration')
    ) {
      // Parse backend health status to UI status using the mapping function
      const healthStatus = parsePipelineStatus(health.overall_status)
      if (healthStatus !== 'active' || pipelineStatus === 'no_configuration') {
        displayStatus = healthStatus
      }
    }

    return {
      displayStatus,
      variant: getVariantForStatus(displayStatus),
      label: getLabelForStatus(displayStatus),
      isHealthLoading: healthLoading,
    }
  }, [pipelineStatus, centralizedStatus, health, healthLoading, isActionLoading])

  return result
}

/**
 * Standalone function to get display status (for use outside React components).
 * Note: This doesn't include recent action tracking - use the hook when possible.
 */
export function getPipelineDisplayStatus(
  pipelineStatus: PipelineStatus | string | undefined,
  centralizedStatus: PipelineStatus | null,
  health: PipelineHealth | null,
  isActionLoading: boolean
): { displayStatus: PipelineStatus; variant: StatusVariant; label: string } {
  let displayStatus: PipelineStatus = centralizedStatus || (pipelineStatus as PipelineStatus) || 'active'

  if (
    !centralizedStatus &&
    health?.overall_status &&
    !isActionLoading &&
    (pipelineStatus === 'active' || !pipelineStatus || pipelineStatus === 'no_configuration')
  ) {
    const healthStatus = parsePipelineStatus(health.overall_status)
    if (healthStatus !== 'active' || pipelineStatus === 'no_configuration') {
      displayStatus = healthStatus
    }
  }

  return {
    displayStatus,
    variant: getVariantForStatus(displayStatus),
    label: getLabelForStatus(displayStatus),
  }
}
