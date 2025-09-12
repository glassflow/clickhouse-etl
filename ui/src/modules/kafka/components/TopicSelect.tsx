import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import { cn } from '@/src/utils/common.client'
import { useState, useMemo } from 'react'

export function TopicSelect({
  value,
  onChange,
  onBlur,
  onOpenChange,
  error,
  placeholder,
  options,
  readOnly,
  standalone,
  label,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onOpenChange: (open: boolean) => void
  error: string
  placeholder: string
  options: { label: string; value: string }[]
  readOnly?: boolean
  standalone?: boolean
  label?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  // Create a mapping from value to label for display purposes
  const valueToLabelMap = useMemo(() => {
    return options.reduce(
      (map, option) => {
        map[option.value] = option.label
        return map
      },
      {} as Record<string, string>,
    )
  }, [options])

  // Convert options to string array for SearchableSelect
  // We'll use labels for search but handle value mapping internally
  const searchableOptions = useMemo(() => {
    return options.map((option) => option.label)
  }, [options])

  // Find the current label for the selected value
  const selectedLabel = value ? valueToLabelMap[value] : ''

  const handleSelect = (selectedLabel: string | null) => {
    if (!selectedLabel) {
      onChange('')
      onBlur()
      return
    }

    // Find the option that matches the selected label
    const selectedOption = options.find((option) => option.label === selectedLabel)
    if (selectedOption) {
      onChange(selectedOption.value)
      onBlur()
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange(open)
  }

  return (
    <div className="relative w-full">
      <SearchableSelect
        availableOptions={searchableOptions}
        selectedOption={selectedLabel}
        onSelect={handleSelect}
        placeholder={placeholder}
        disabled={readOnly}
        clearable={true}
        open={isOpen}
        onOpenChange={handleOpenChange}
        readOnly={readOnly}
        label={label}
        className={cn('w-full', error && '[&_input]:border-red-500 [&_input]:border-2')}
      />
    </div>
  )
}
