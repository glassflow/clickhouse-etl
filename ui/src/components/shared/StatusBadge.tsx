import React from 'react'
import { Badge } from '@/src/components/ui/badge'
import { structuredLogger } from '@/src/observability'
import { PIPELINE_STATUS_CONFIG, StatusType } from '@/src/config/constants'
import { cn } from '@/src/utils/common.client'
import { PIPELINE_STATUS_MAP } from '@/src/config/constants'

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const statusConfig = PIPELINE_STATUS_CONFIG[status]

  if (!statusConfig) {
    structuredLogger.warn('Unknown pipeline status', { status })
    return null
  }

  let statusClass = 'chip-neutral'

  switch (status) {
    case PIPELINE_STATUS_MAP.active:
      statusClass = 'chip-positive'
      break
    case PIPELINE_STATUS_MAP.paused:
    case 'pausing':
      statusClass = 'chip-neutral'
      break
    case PIPELINE_STATUS_MAP.starting:
    case PIPELINE_STATUS_MAP.stopped:
    case PIPELINE_STATUS_MAP.stopping:
    case PIPELINE_STATUS_MAP.resuming:
      statusClass = 'chip-neutral-faded'
      break
    case PIPELINE_STATUS_MAP.failed:
      statusClass = 'chip-negative'
      break
  }

  return <Badge className={cn(statusClass, className, 'chip')}>{statusConfig.label}</Badge>
}

export default StatusBadge
