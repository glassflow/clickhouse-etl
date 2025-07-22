import { useState, useEffect } from 'react'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { cn } from '@/src/utils/common.client'

type SimpleDropdownProps = {
  label: string
  defaultValue: string
  onSelect: (option: string) => void
  isLoading: boolean
  error: string
  optionsList: string[]
  placeholder: string
}

export const SimpleDropdown = ({
  label,
  defaultValue,
  onSelect,
  isLoading,
  error,
  optionsList,
  placeholder,
}: SimpleDropdownProps) => {
  // Track focus state
  const [isFocused, setIsFocused] = useState(false)
  const [selectedValue, setSelectedValue] = useState(defaultValue)

  // Update selectedValue when defaultValue changes
  useEffect(() => {
    if (defaultValue) {
      setSelectedValue(defaultValue)
    }
  }, [defaultValue])

  return (
    <div className="space-y-2 w-full min-w-[200px]">
      <Label htmlFor="topic-select">{label}</Label>
      <Select
        value={selectedValue}
        onValueChange={(value) => {
          setSelectedValue(value)
          onSelect(value)
        }}
        onOpenChange={(open) => {
          // Consider the dropdown focused when it's open
          setIsFocused(open)
        }}
      >
        <SelectTrigger
          className={cn(
            'w-full',
            'input-regular',
            'input-border-regular',
            error && 'input-border-error',
            isFocused && 'card-gradient-active',
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Only blur if the dropdown is closed
            // This prevents losing the focus styles when clicking an option
            if (!document.querySelector('[data-state="open"]')) {
              setIsFocused(false)
            }
          }}
        >
          <SelectValue placeholder={isLoading ? 'Loading topics...' : placeholder} />
        </SelectTrigger>
        <SelectContent className="select-content-custom">
          {error ? (
            <div className="p-2 text-red-500">{error}</div>
          ) : isLoading ? (
            <div className="p-2">Loading options...</div>
          ) : !optionsList || optionsList.length === 0 ? (
            <div className="p-2">No options found</div>
          ) : (
            optionsList.map((option: string) => (
              <SelectItem key={option} value={option} className="select-item-custom">
                {option}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {error && <p className="input-description-error text-sm">{error}</p>}
    </div>
  )
}
