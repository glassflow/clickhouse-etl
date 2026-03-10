'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { TimeUnitSelector } from './TimeUnitSelector'

type BatchDelaySelectorProps = {
  maxBatchSize: number
  maxDelayTime: number
  maxDelayTimeUnit: string
  onMaxBatchSizeChange: (value: number) => void
  onMaxDelayTimeChange: (value: number) => void
  onMaxDelayTimeUnitChange: (value: string) => void
  readOnly?: boolean
}

export function BatchDelaySelector({
  maxBatchSize,
  maxDelayTime,
  maxDelayTimeUnit,
  onMaxBatchSizeChange,
  onMaxDelayTimeChange,
  onMaxDelayTimeUnitChange,
  readOnly,
}: BatchDelaySelectorProps) {
  const [maxBatchSizeLocal, setMaxBatchSizeLocal] = useState<number | null>(maxBatchSize)
  const [maxDelayTimeLocal, setMaxDelayTimeLocal] = useState<number | null>(maxDelayTime)
  const [maxDelayTimeUnitLocal, setMaxDelayTimeUnitLocal] = useState(maxDelayTimeUnit)

  // Sync local state with props when they change
  useEffect(() => {
    setMaxBatchSizeLocal(maxBatchSize)
  }, [maxBatchSize])

  useEffect(() => {
    setMaxDelayTimeLocal(maxDelayTime)
  }, [maxDelayTime])

  useEffect(() => {
    setMaxDelayTimeUnitLocal(maxDelayTimeUnit)
  }, [maxDelayTimeUnit])

  useEffect(() => {
    onMaxBatchSizeChange(maxBatchSizeLocal || 0)
  }, [maxBatchSizeLocal, onMaxBatchSizeChange])

  useEffect(() => {
    onMaxDelayTimeChange(maxDelayTimeLocal || 0)
  }, [maxDelayTimeLocal, onMaxDelayTimeChange])

  useEffect(() => {
    onMaxDelayTimeUnitChange(maxDelayTimeUnitLocal)
  }, [maxDelayTimeUnitLocal, onMaxDelayTimeUnitChange])

  const labelClass = 'text-sm font-medium text-muted-foreground text-content'
  const batchSizeInput = (
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
      className="text-sm text-content"
      disabled={readOnly}
    />
  )
  const delayTimeInput = (
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
      className="text-sm text-content"
      disabled={readOnly}
    />
  )
  const timeUnitSelector = (
    <TimeUnitSelector
      value={maxDelayTimeUnitLocal}
      onChange={(value) => {
        setMaxDelayTimeUnitLocal(value)
      }}
      className="text-sm text-content"
      disabled={readOnly}
    />
  )

  return (
    <>
      {/* Narrow: vertical stack */}
      <div className="flex flex-col gap-4 w-full mb-4 sm:hidden">
        <div className="flex flex-col gap-2 w-full">
          <Label className={labelClass}>Max Batch Size (No. of events)</Label>
          {batchSizeInput}
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Label className={labelClass}>Max Delay Time</Label>
          {delayTimeInput}
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Label className={labelClass}>Max Delay Time Unit</Label>
          {timeUnitSelector}
        </div>
      </div>

      {/* Wide: two-row grid (labels row + inputs row) for alignment */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-x-4 gap-y-2 mb-4 w-full sm:w-2/3">
        <Label className={labelClass}>Max Batch Size (No. of events)</Label>
        <Label className={labelClass}>Max Delay Time</Label>
        <Label className={labelClass}>Max Delay Time Unit</Label>
        {batchSizeInput}
        {delayTimeInput}
        {timeUnitSelector}
      </div>
    </>
  )
}
