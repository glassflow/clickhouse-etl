import React from 'react'
import { Badge } from '../ui/badge'
import { PIPELINE_STATUS_CONFIG, StatusType } from '../../config/constants'
import { cn } from '@/src/utils/common.client'
import { PIPELINE_STATUS_MAP } from '@/src/config/constants'

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const statusConfig = PIPELINE_STATUS_CONFIG[status]

  if (!statusConfig) {
    console.warn(`Unknown status: ${status}`)
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
    case PIPELINE_STATUS_MAP.stopped:
    case PIPELINE_STATUS_MAP.stopping:
      statusClass = 'chip-neutral-faded'
      break
    case PIPELINE_STATUS_MAP.failed:
      statusClass = 'chip-negative'
      break
  }

  return <Badge className={cn(statusClass, className, 'chip')}>{statusConfig.label}</Badge>
}

export default StatusBadge
