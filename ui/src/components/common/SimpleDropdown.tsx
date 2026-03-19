import { useState, useEffect } from 'react'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'

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
  const [selectedValue, setSelectedValue] = useState(defaultValue)

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
      >
        <SelectTrigger error={!!error} className="w-full">
          <SelectValue placeholder={isLoading ? 'Loading topics...' : placeholder} />
        </SelectTrigger>
        <SelectContent className="select-content-custom">
          {error ? (
            <div className="p-2 text-[var(--control-fg-error)]">{error}</div>
          ) : isLoading ? (
            <div className="p-2 text-[var(--surface-fg-muted)]">Loading options...</div>
          ) : !optionsList || optionsList.length === 0 ? (
            <div className="p-2 text-[var(--surface-fg-muted)]">No options found</div>
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
