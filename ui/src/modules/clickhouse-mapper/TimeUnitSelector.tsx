'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { MAX_DELAY_TIME_UNITS } from '@/src/config/constants'
import { cn } from '@/src/utils'

export function TimeUnitSelector({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          'w-full',
          'input-regular',
          'input-border-regular',
          'transition-all duration-200 ease-in-out',
          'text-content',
          className,
        )}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          if (!document.querySelector('[data-state="open"]')) {
            setIsFocused(false)
          }
        }}
      >
        <SelectValue placeholder="Select type" className="text-content" />
      </SelectTrigger>
      <SelectContent className="select-content-custom animate-fadeIn text-content">
        {MAX_DELAY_TIME_UNITS.map(([key, value]) => (
          <SelectItem key={key} value={value.value} className="select-item-custom text-content">
            {value.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
