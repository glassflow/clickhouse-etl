'use client'

import { Label } from '@/src/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/src/components/ui/tooltip'
import Image from 'next/image'
import InfoIcon from '@/src/images/info.svg'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Input } from '@/src/components/ui/input'
import { TimeWindowConfigurator } from '@/src/modules/deduplication/components/TimeWindowConfigurator'

// Constants for time conversion
const MAX_DAYS = 7
const HOURS_IN_DAY = 24
const MINUTES_IN_HOUR = 60
const SECONDS_IN_MINUTE = 60

const MAX_HOURS = MAX_DAYS * HOURS_IN_DAY
const MAX_MINUTES = MAX_HOURS * MINUTES_IN_HOUR
const MAX_SECONDS = MAX_MINUTES * SECONDS_IN_MINUTE

interface StreamConfiguratorProps {
  streamIndex: number
  stream: {
    joinKey: string
    dataType: string
    joinTimeWindowValue: number
    joinTimeWindowUnit: string
  }
  availableKeys: { label: string; value: string }[]
  onChange: (streamIndex: number, field: string, value: any) => void
  errors?: {
    joinKey?: string
    dataType?: string
    joinTimeWindowValue?: string
  }
  readOnly?: boolean
}

export function StreamConfigurator({
  streamIndex,
  stream,
  availableKeys,
  onChange,
  errors = {},
  readOnly,
}: StreamConfiguratorProps) {
  const getMaxValueForUnit = (unit: string) => {
    switch (unit) {
      case TIME_WINDOW_UNIT_OPTIONS.DAYS.value:
        return MAX_DAYS
      case TIME_WINDOW_UNIT_OPTIONS.HOURS.value:
        return MAX_HOURS
      case TIME_WINDOW_UNIT_OPTIONS.MINUTES.value:
        return MAX_MINUTES
      case TIME_WINDOW_UNIT_OPTIONS.SECONDS.value:
        return MAX_SECONDS
      default:
        return MAX_DAYS
    }
  }

  const handleTimeWindowChange = (value: string) => {
    const numValue = parseInt(value)
    const maxValue = getMaxValueForUnit(stream.joinTimeWindowUnit)
    const clampedValue = Math.min(numValue, maxValue)
    onChange(streamIndex, 'joinTimeWindowValue', clampedValue)
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Stream {streamIndex + 1}</h4>
      <div className="flex flex-col space-y-8">
        {/* Join Key and Data Type fields - split row (2/3 + 1/3) */}
        <div className="w-[90%] flex gap-3">
          <div className="w-2/3">
            <div className="space-y-2">
              <Label htmlFor={`join-key-${streamIndex}`} className="label-regular text-content">
                Join Key
              </Label>
              <Select
                value={stream.joinKey}
                onValueChange={(value) => onChange(streamIndex, 'joinKey', value)}
                disabled={readOnly}
              >
                <SelectTrigger
                  id={`join-key-${streamIndex}`}
                  className={`w-full input-regular select-content-custom text-content ${
                    errors.joinKey ? 'border-red-500' : ''
                  }`}
                >
                  <SelectValue placeholder="Select join key" />
                </SelectTrigger>
                <SelectContent className="select-content-custom">
                  {availableKeys.map((key) => (
                    <SelectItem key={key.value} value={key.value} className="select-item-custom text-content">
                      {key.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.joinKey && <p className="text-sm text-red-500">{errors.joinKey}</p>}
            </div>
          </div>
          <div className="w-1/3">
            <div className="space-y-2">
              <Label htmlFor={`data-type-${streamIndex}`} className="label-regular text-content">
                Data Type
              </Label>
              <Select
                value={stream.dataType}
                onValueChange={(value) => onChange(streamIndex, 'dataType', value)}
                disabled={readOnly}
              >
                <SelectTrigger
                  id={`data-type-${streamIndex}`}
                  className={`w-full input-regular select-content-custom text-content ${
                    errors.dataType ? 'border-red-500' : ''
                  }`}
                >
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent className="select-content-custom">
                  {[
                    { label: 'String', value: 'string' },
                    { label: 'Number', value: 'number' },
                    { label: 'Boolean', value: 'boolean' },
                  ].map((type) => (
                    <SelectItem key={type.value} value={type.value} className="select-item-custom text-content">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.dataType && <p className="text-sm text-red-500">{errors.dataType}</p>}
            </div>
          </div>
        </div>

        {/* Time Window Configuration */}
        <div className="w-[90%]">
          <TimeWindowConfigurator
            window={stream.joinTimeWindowValue}
            setWindow={(value) => onChange(streamIndex, 'joinTimeWindowValue', value)}
            windowUnit={stream.joinTimeWindowUnit}
            setWindowUnit={(value) => onChange(streamIndex, 'joinTimeWindowUnit', value)}
            label="Join Time Window"
            tooltip="Set a value between 5 minutes to 7 days, with 1M events limit. Longer time windows can process more events but may result in slower performance."
            readOnly={readOnly}
          />
          {errors.joinTimeWindowValue && <p className="text-sm text-red-500">{errors.joinTimeWindowValue}</p>}
        </div>
      </div>
    </div>
  )
}
