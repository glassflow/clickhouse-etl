'use client'

import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { TimeWindowConfigurator } from '@/src/modules/deduplication/components/TimeWindowConfigurator'

interface StreamConfiguratorProps {
  streamIndex: number
  stream: {
    joinKey: string
    joinTimeWindowValue: number
    joinTimeWindowUnit: string
  }
  availableKeys: { label: string; value: string }[]
  onChange: (streamIndex: number, field: string, value: any) => void
  errors?: {
    joinKey?: string
    joinTimeWindowValue?: string
    joinTimeWindowUnit?: string
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
  return (
    <div className="space-y-4">
      <h4 className="font-medium">Stream {streamIndex + 1}</h4>
      <div className="flex flex-col gap-3">
        {/* Join Key and Data Type fields - split row (2/3 + 1/3) */}
        <div className="w-full">
          <div className="w-[65%]">
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
                  className={`w-full input-regular input-border-regular text-content ${errors.joinKey ? 'border-red-500' : ''
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
        </div>

        {/* Time Window Configuration */}
        <div className="w-full">
          <div className="w-[65%]">
            <TimeWindowConfigurator
              window={stream.joinTimeWindowValue}
              setWindow={(value) => onChange(streamIndex, 'joinTimeWindowValue', value)}
              windowUnit={stream.joinTimeWindowUnit}
              setWindowUnit={(value) => onChange(streamIndex, 'joinTimeWindowUnit', value)}
              label="Join Time Window"
              tooltip="Maximum time window is 7 days. Longer time windows can process more events but may result in slower performance."
              readOnly={readOnly}
            />
          </div>
          {errors.joinTimeWindowValue && <p className="text-sm text-red-500">{errors.joinTimeWindowValue}</p>}
          {errors.joinTimeWindowUnit && <p className="text-sm text-red-500">{errors.joinTimeWindowUnit}</p>}
        </div>
      </div>
    </div>
  )
}
