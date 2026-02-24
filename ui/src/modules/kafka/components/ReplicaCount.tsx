'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import InfoIcon from '@/src/images/info.svg'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'

export type ReplicaCountProps = {
  partitionCount: number
  replicas: number
  onReplicaCountChange?: (replicas: number) => void
  index: number
  readOnly?: boolean
  isLoading?: boolean
}

export default function ReplicaCount({
  partitionCount,
  replicas,
  onReplicaCountChange,
  index,
  readOnly,
  isLoading,
}: ReplicaCountProps) {
  const [selectedReplicaCount, setSelectedReplicaCount] = useState(replicas)

  // Sync local state with prop changes and set default to max partition when partition count changes
  useEffect(() => {
    if (partitionCount > 0) {
      // If replica count is not set or is 0, default to partition count
      const newReplicaCount = replicas > 0 ? replicas : partitionCount
      setSelectedReplicaCount(newReplicaCount)
      // Notify parent of the default value if it wasn't set
      if (replicas === 0 && onReplicaCountChange) {
        onReplicaCountChange(partitionCount)
      }
    }
  }, [partitionCount, replicas, onReplicaCountChange])

  const handleReplicaCountChange = (replicas: number) => {
    setSelectedReplicaCount(replicas)
    onReplicaCountChange?.(replicas)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor={`partition-input-${index}`} className="block text-sm font-medium text-content">
          Replica Count
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Image src={InfoIcon} alt="Info" className="w-4 h-4" />
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="start"
            className="max-w-[300px] bg-gray-800 text-gray-100 border border-gray-700 rounded-lg p-3 shadow-lg"
          >
            <p className="text-sm leading-relaxed">
              Decreasing the number of replicas will result in slower performance, but it will reduce resource usage
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center space-x-2">
        <input
          id={`partition-input-${index}`}
          type="number"
          min="1"
          max={partitionCount || 1}
          value={selectedReplicaCount}
          onChange={(e) => {
            const value = parseInt(e.target.value)
            if (!isNaN(value) && value >= 1 && value <= (partitionCount || 1)) {
              handleReplicaCountChange(value)
            }
          }}
          onBlur={(e) => {
            const value = parseInt(e.target.value)
            if (isNaN(value) || value < 1) {
              handleReplicaCountChange(1)
            } else if (value > (partitionCount || 1)) {
              handleReplicaCountChange(partitionCount || 1)
            }
          }}
          onKeyDown={(e) => {
            // Prevent invalid characters
            if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
              e.preventDefault()
            }
          }}
          disabled={readOnly || isLoading || partitionCount === 0}
          className="px-3 py-2 rounded-md text-sm w-24"
          placeholder="1"
        />
        <span className="text-sm text-content">
          {partitionCount > 0 ? `(Must be between 1 and ${partitionCount})` : '(Loading partition details...)'}
        </span>
      </div>
    </div>
  )
}
