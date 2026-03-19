import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import { cn } from '@/src/utils/common.client'
import { useState, useMemo } from 'react'
import { CacheRefreshButton } from '@/src/modules/clickhouse/components/CacheRefreshButton'

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
  onRefresh,
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
  onRefresh?: () => Promise<void>
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
    <div className="flex items-start justify-between gap-2">
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
          className="w-full"
          label={label}
          error={error}
        />
      </div>

      {onRefresh && (
        <div className="flex-shrink-0 mt-3.5">
          <CacheRefreshButton
            disabled={readOnly}
            type="topics"
            onRefresh={onRefresh}
            size="sm"
            variant="ghost"
            className="transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
          />
        </div>
      )}
    </div>
  )
}
