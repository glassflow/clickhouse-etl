import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { cn } from '@/src/utils'
import { useState } from 'react'

export function TopicSelect({
  value,
  onChange,
  onBlur,
  onOpenChange,
  error,
  placeholder,
  options,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onOpenChange: (open: boolean) => void
  error: string
  placeholder: string
  options: { label: string; value: string }[]
}) {
  const [isFocused, setIsFocused] = useState(false)
  return (
    <div className="relative w-full">
      <Select
        value={value}
        defaultValue={value}
        onValueChange={(value) => {
          onChange(value)
          onBlur()
        }}
        onOpenChange={(open) => {
          setIsFocused(open)
        }}
      >
        <SelectTrigger
          className={cn(
            'w-full',
            'input-regular',
            'input-border-regular',
            'transition-all duration-200 ease-in-out',
            'text-content',
            error && 'input-border-error',
            isFocused && 'input-active scale-[1.01]',
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            if (!document.querySelector('[data-state="open"]')) {
              setIsFocused(false)
              onBlur()
            }
          }}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="select-content-custom animate-fadeIn">
          {options.length === 0 ? (
            <div className="p-2 animate-pulse">No options found</div>
          ) : (
            options.map((option) => {
              return (
                <SelectItem
                  key={`${option.value}`}
                  value={option.value}
                  className="select-item-custom transition-colors duration-150 hover:scale-[1.02] transition-transform text-content"
                >
                  {option.label}
                </SelectItem>
              )
            })
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
