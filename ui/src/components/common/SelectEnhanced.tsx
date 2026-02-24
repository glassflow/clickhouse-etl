import { useState, useEffect } from 'react'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'

type SelectEnhancedProps = {
  label: string
  defaultValue: string
  onSelect: (option: string) => void
  isLoading: boolean
  error: string
  options: Array<{ label: string; value: string }>
  placeholder: string
  disabled?: boolean
}

export const SelectEnhanced = ({
  label,
  defaultValue,
  onSelect,
  isLoading,
  error,
  options,
  placeholder,
  disabled,
}: SelectEnhancedProps) => {
  const [selectedValue, setSelectedValue] = useState(defaultValue)

  useEffect(() => {
    if (defaultValue) {
      setSelectedValue(defaultValue)
    }
  }, [defaultValue])

  return (
    <div className="w-full min-w-[200px]">
      {label && (
        <Label htmlFor="topic-select" className="text-xs text-content mb-1 block">
          {label}
        </Label>
      )}
      <div className="space-y-0">
        <Select
          value={selectedValue}
          onValueChange={(value) => {
            setSelectedValue(value)
            onSelect(value)
          }}
          disabled={disabled}
        >
          <SelectTrigger error={!!error} className="w-full">
            <SelectValue placeholder={isLoading ? 'Loading topics...' : placeholder} />
          </SelectTrigger>
          <SelectContent className="select-content-custom">
            {error ? (
              <div className="p-2 input-description-error">{error}</div>
            ) : isLoading ? (
              <div className="p-2">Loading options...</div>
            ) : !options || options.length === 0 ? (
              <div className="p-2">No options found</div>
            ) : (
              options.map((option: { label: string; value: string }) => (
                <SelectItem key={option.value} value={option.value} className="select-item-custom">
                  {option.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {/* Reserve space for error message to prevent layout shift */}
        <div className="h-5 mt-0.5">{error && <p className="input-description-error text-sm">{error}</p>}</div>
      </div>
    </div>
  )
}
