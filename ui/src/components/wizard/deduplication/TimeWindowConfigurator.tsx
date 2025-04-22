'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'
import Image from 'next/image'
import InfoIcon from '@/src/images/info.svg'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/src/components/ui/tooltip'

interface TimeWindowConfiguratorProps {
  window: number
  setWindow: (value: number) => void
  windowUnit: string
  setWindowUnit: (value: string) => void
  label?: string
  tooltip?: string
}

export function TimeWindowConfigurator({
  window,
  setWindow,
  windowUnit,
  setWindowUnit,
  label = 'Deduplication Time Window',
  tooltip = 'Set a value between 5 minutes to 7 days, with 1M events limit. Longer time windows can process more events but may result in slower performance.',
}: TimeWindowConfiguratorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="window-unit" className="label-regular text-content">
          {label}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Image src={InfoIcon} alt="Info" className="w-4 h-4" />
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="start"
              className="max-w-[300px] bg-gray-800 text-gray-100 border border-gray-700 rounded-lg p-3 shadow-lg"
            >
              <p className="text-sm leading-relaxed">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex gap-4">
        <div className="w-[20%] max-w-[20%]">
          <Input
            id="window-size"
            type="number"
            value={window}
            onChange={(e) => setWindow(parseInt(e.target.value))}
            min="1"
            className="w-full input-regular input-border-regular text-content"
          />
        </div>
        <div className="w-[45%] max-w-[45%]">
          <Select value={windowUnit} onValueChange={setWindowUnit}>
            <SelectTrigger id="window-unit" className="w-full input-regular select-content-custom text-content">
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
    </div>
  )
}
