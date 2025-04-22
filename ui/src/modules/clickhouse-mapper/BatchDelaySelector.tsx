'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { TimeUnitSelector } from './TimeUnitSelector'

export function BatchDelaySelector({
  maxBatchSize,
  maxDelayTime,
  maxDelayTimeUnit,
  onMaxBatchSizeChange,
  onMaxDelayTimeChange,
  onMaxDelayTimeUnitChange,
}: {
  maxBatchSize: number
  maxDelayTime: number
  maxDelayTimeUnit: string
  onMaxBatchSizeChange: (value: number) => void
  onMaxDelayTimeChange: (value: number) => void
  onMaxDelayTimeUnitChange: (value: string) => void
}) {
  const [maxBatchSizeLocal, setMaxBatchSizeLocal] = useState<number | null>(maxBatchSize)
  const [maxDelayTimeLocal, setMaxDelayTimeLocal] = useState<number | null>(maxDelayTime)
  const [maxDelayTimeUnitLocal, setMaxDelayTimeUnitLocal] = useState(maxDelayTimeUnit)

  useEffect(() => {
    onMaxBatchSizeChange(maxBatchSizeLocal || 0)
  }, [maxBatchSizeLocal])

  useEffect(() => {
    onMaxDelayTimeChange(maxDelayTimeLocal || 0)
  }, [maxDelayTimeLocal])

  useEffect(() => {
    onMaxDelayTimeUnitChange(maxDelayTimeUnitLocal)
  }, [maxDelayTimeUnitLocal])

  // Ensure we have default values if they're undefined
  return (
    <div className="flex gap-4 w-2/3 mb-4">
      <div className="flex flex-col gap-2 w-1/3">
        <Label className="text-sm font-medium text-muted-foreground text-content">Max Batch Size (No. of events)</Label>
        <Input
          type="text"
          placeholder="Max Batch Size"
          value={maxBatchSizeLocal?.toString() || ''}
          onChange={(e) => {
            const value = e.target.value
            if (value === '') {
              setMaxBatchSizeLocal(null)
            } else {
              const numValue = parseInt(value)
              if (!isNaN(numValue)) {
                setMaxBatchSizeLocal(numValue)
              }
            }
          }}
          className="text-sm text-content input-regular input-border-regular"
        />
      </div>

      <div className="flex flex-col gap-2 w-1/3">
        <Label className="text-sm font-medium text-muted-foreground text-content">Max Delay Time</Label>
        <Input
          type="text"
          placeholder="Max Delay Time"
          value={maxDelayTimeLocal?.toString() || ''}
          onChange={(e) => {
            const value = e.target.value
            if (value === '') {
              setMaxDelayTimeLocal(null)
            } else {
              const numValue = parseInt(value)
              if (!isNaN(numValue)) {
                setMaxDelayTimeLocal(numValue)
              }
            }
          }}
          className="text-sm text-content input-regular input-border-regular"
        />
      </div>

      <div className="flex flex-col gap-2 w-1/3">
        <Label className="text-sm font-medium text-muted-foreground text-content">Max Delay Time Unit</Label>
        <TimeUnitSelector
          value={maxDelayTimeUnitLocal}
          onChange={(value) => {
            setMaxDelayTimeUnitLocal(value)
          }}
          className="text-sm text-content input-regular input-border-regular"
        />
      </div>
    </div>
  )
}
