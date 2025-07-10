import React from 'react'
import { StatusBadge } from './StatusBadge'
import { StatusType } from '../../config/constants'

export const StatusBadgeExample: React.FC = () => {
  const statuses: StatusType[] = ['active', 'paused', 'pausing', 'deleting']

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold">Status Badge Examples</h2>
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>

      <h3 className="text-md font-medium mt-4">With Custom Classes</h3>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status="active" className="text-sm" />
        <StatusBadge status="paused" className="text-lg" />
        <StatusBadge status="pausing" className="font-bold" />
        <StatusBadge status="deleting" className="uppercase" />
      </div>
    </div>
  )
}

export default StatusBadgeExample
