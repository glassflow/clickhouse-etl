'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'
import Image from 'next/image'
import InfoIcon from '@/src/images/info.svg'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import { useState, useEffect } from 'react'

interface TimeWindowConfiguratorProps {
  window: number
  setWindow: (value: number) => void
  windowUnit: string
  setWindowUnit: (value: string) => void
  label?: string
  tooltip?: string
  readOnly?: boolean
}

// Constants for time conversion
const MAX_DAYS = 7
const HOURS_IN_DAY = 24
const MINUTES_IN_HOUR = 60
const SECONDS_IN_MINUTE = 60

const MAX_HOURS = MAX_DAYS * HOURS_IN_DAY
const MAX_MINUTES = MAX_HOURS * MINUTES_IN_HOUR
const MAX_SECONDS = MAX_MINUTES * SECONDS_IN_MINUTE

export function TimeWindowConfigurator({
  window,
  setWindow,
  windowUnit,
  setWindowUnit,
  label = 'Deduplication Time Window',
  tooltip = 'Maximum time window is 7 days. Longer time windows can process more events but may result in slower performance.',
  readOnly,
}: TimeWindowConfiguratorProps) {
  const [error, setError] = useState<string | null>(null)

  const validateTimeWindow = (value: number, unit: string) => {
    switch (unit) {
      case TIME_WINDOW_UNIT_OPTIONS.DAYS.value:
        if (value > MAX_DAYS) {
          setError(`Maximum time window is ${MAX_DAYS} days`)
          return false
        }
        break
      case TIME_WINDOW_UNIT_OPTIONS.HOURS.value:
        if (value > MAX_HOURS) {
          setError(`Maximum time window is ${MAX_HOURS} hours (${MAX_DAYS} days)`)
          return false
        }
        break
      case TIME_WINDOW_UNIT_OPTIONS.MINUTES.value:
        if (value > MAX_MINUTES) {
          setError(`Maximum time window is ${MAX_MINUTES} minutes (${MAX_DAYS} days)`)
          return false
        }
        break
      case TIME_WINDOW_UNIT_OPTIONS.SECONDS.value:
        if (value > MAX_SECONDS) {
          setError(`Maximum time window is ${MAX_SECONDS} seconds (${MAX_DAYS} days)`)
          return false
        }
        break
    }
    setError(null)
    return true
  }

  const handleWindowChange = (value: string) => {
    const numValue = parseInt(value)
    if (validateTimeWindow(numValue, windowUnit)) {
      setWindow(numValue)
    }
  }

  const handleUnitChange = (unit: string) => {
    if (validateTimeWindow(window, unit)) {
      setWindowUnit(unit)
    }
  }

  // Validate on initial render and when unit changes
  useEffect(() => {
    validateTimeWindow(window, windowUnit)
  }, [window, windowUnit])

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2">
        <Label htmlFor="window-unit" className="label-regular text-content">
          {label}
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Image src={InfoIcon} alt="Info" className="w-4 h-4" />
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="start"
            className="max-w-[300px] bg-[var(--surface-bg)] text-[var(--surface-fg)] border border-[var(--surface-border)] rounded-lg p-3 shadow-lg"
          >
            <p className="text-sm leading-relaxed">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <div className="flex gap-4">
          <div className="w-[35%] max-w-[35%]">
            <Input
              id="window-size"
              type="number"
              value={window}
              onChange={(e) => handleWindowChange(e.target.value)}
              min="1"
              error={!!error}
              className="w-full text-content"
              disabled={readOnly}
            />
          </div>
          <div className="w-[65%] max-w-[65%]">
            <Select value={windowUnit} onValueChange={handleUnitChange} disabled={readOnly}>
              <SelectTrigger id="window-unit" className="w-full text-content">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent className="select-content-custom">
                {Object.values(TIME_WINDOW_UNIT_OPTIONS).map((option) => (
                  <SelectItem key={option.value} value={option.value} className="select-item-custom text-content">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && <p className="text-sm input-description-error">{error}</p>}
      </div>
    </div>
  )
}
