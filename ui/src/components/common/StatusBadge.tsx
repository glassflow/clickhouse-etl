import React from 'react'
import { Badge } from '../ui/badge'
import { STATUS_CONFIG, StatusType } from '../../config/constants'
import classnames from 'classnames'

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const statusConfig = STATUS_CONFIG[status]

  if (!statusConfig) {
    console.warn(`Unknown status: ${status}`)
    return null
  }

  let statusClass = 'chip-neutral'

  switch (status) {
    case 'active':
      statusClass = 'chip-positive'
      break
    case 'paused':
    case 'pausing':
      statusClass = 'chip-neutral'
      break
    case 'deleting':
    case 'terminated':
    case 'deleted':
      statusClass = 'chip-neutral-faded'
      break
    case 'error':
      statusClass = 'chip-negative'
      break
  }

  return <Badge className={classnames(statusClass, className, 'chip')}>{statusConfig.label}</Badge>
}

export default StatusBadge
