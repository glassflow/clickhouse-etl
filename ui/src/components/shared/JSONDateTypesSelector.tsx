'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { JSON_DATA_TYPES, JSON_DATA_TYPES_DEDUPLICATION_JOIN } from '@/src/config/constants'
import { cn } from '@/src/utils/common.client'

export function JSONDateTypesSelector({
  value,
  onChange,
  className,
  isDeduplicationJoin,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  isDeduplicationJoin?: boolean
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
        {isDeduplicationJoin
          ? JSON_DATA_TYPES_DEDUPLICATION_JOIN.map((type) => (
              <SelectItem key={type} value={type} className="select-item-custom text-content">
                {type}
              </SelectItem>
            ))
          : JSON_DATA_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="select-item-custom text-content">
                {type}
              </SelectItem>
            ))}
      </SelectContent>
    </Select>
  )
}
