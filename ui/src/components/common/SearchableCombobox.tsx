'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { useCombobox } from '@/src/components/ui/use-combobox'
import { cn } from '@/src/utils/common.client'

export interface SearchableComboboxProps<T> {
  /** Currently selected value (the string returned by getOptionValue) */
  value: string
  /** Callback when value changes */
  onValueChange: (value: string) => void
  /** Array of options to display */
  options: T[]
  /** Extract the string value from an option (used for selection and as key) */
  getOptionValue: (option: T) => string
  /** Render the label for each option in the dropdown */
  getOptionLabel: (option: T) => React.ReactNode
  /** Get searchable text for an option (defaults to stringified getOptionLabel) */
  getSearchableText?: (option: T) => string
  /** Render the selected value in the trigger (defaults to getOptionLabel) */
  renderSelectedValue?: (option: T) => React.ReactNode
  /** Custom filter function (defaults to case-insensitive search on getSearchableText) */
  filterOptions?: (options: T[], search: string) => T[]
  /** Placeholder text when no value selected */
  placeholder?: string
  /** Placeholder text in search input */
  searchPlaceholder?: string
  /** Message when no options match search */
  emptyMessage?: string
  /** Disable the combobox */
  disabled?: boolean
  /** Show error styling */
  error?: boolean
  /** Additional class name for the root */
  className?: string
  /** Additional class name for the trigger button */
  triggerClassName?: string
  /** Minimum width for the dropdown (defaults to trigger width) */
  minDropdownWidth?: number
}

/**
 * Generic searchable combobox component.
 * Renders a button trigger with a searchable dropdown list.
 * Works with any option type via render props.
 */
export function SearchableCombobox<T>({
  value,
  onValueChange,
  options,
  getOptionValue,
  getOptionLabel,
  getSearchableText,
  renderSelectedValue,
  filterOptions,
  placeholder = 'Select option',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  error,
  className,
  triggerClassName,
  minDropdownWidth,
}: SearchableComboboxProps<T>) {
  const {
    open,
    setOpen,
    search,
    setSearch,
    highlightedIndex,
    setHighlightedIndex,
    triggerRef,
    inputRef,
    triggerWidth,
    handleOpenAutoFocus,
  } = useCombobox<T>({
    items: [],
    onSelect: (option) => onValueChange(getOptionValue(option)),
  })

  // Default searchable text extractor
  const getSearchText = useCallback(
    (option: T): string => {
      if (getSearchableText) {
        return getSearchableText(option)
      }
      // Fallback: stringify the label if it's a string, otherwise use value
      const label = getOptionLabel(option)
      return typeof label === 'string' ? label : getOptionValue(option)
    },
    [getSearchableText, getOptionLabel, getOptionValue],
  )

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!search) return options

    if (filterOptions) {
      return filterOptions(options, search)
    }

    // Default: case-insensitive search on searchable text
    const s = search.toLowerCase()
    return options.filter((option) => getSearchText(option).toLowerCase().includes(s))
  }, [options, search, filterOptions, getSearchText])

  // Find selected option
  const selectedOption = useMemo(() => {
    return options.find((option) => getOptionValue(option) === value)
  }, [options, value, getOptionValue])

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions.length, setHighlightedIndex])

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredOptions.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length)
          break
        case 'Enter':
          e.preventDefault()
          if (filteredOptions[highlightedIndex]) {
            onValueChange(getOptionValue(filteredOptions[highlightedIndex]))
            setOpen(false)
          }
          break
        case 'Escape':
          setOpen(false)
          break
      }
    },
    [filteredOptions, highlightedIndex, onValueChange, getOptionValue, setHighlightedIndex, setOpen],
  )

  // Calculate dropdown min width
  const dropdownMinWidth = useMemo(() => {
    if (minDropdownWidth !== undefined) {
      return Math.max(triggerWidth ?? 0, minDropdownWidth)
    }
    return triggerWidth
  }, [triggerWidth, minDropdownWidth])

  // Render selected value in trigger
  const renderTriggerValue = () => {
    if (!selectedOption) {
      return placeholder
    }
    if (renderSelectedValue) {
      return renderSelectedValue(selectedOption)
    }
    return getOptionLabel(selectedOption)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          data-slot="select-trigger"
          data-placeholder={!value ? '' : undefined}
          className={cn(
            'flex w-full items-center justify-between gap-2 whitespace-nowrap',
            '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
            '[&_svg:not([class*="text-"])]:opacity-50',
            'disabled:cursor-not-allowed',
            error && 'border-[var(--color-border-critical)]',
            triggerClassName,
            className,
          )}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="truncate">{renderTriggerValue()}</span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="select-content-custom p-0"
        align="start"
        style={dropdownMinWidth !== undefined ? { minWidth: dropdownMinWidth } : undefined}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-[var(--surface-border)] px-3 py-2">
          <MagnifyingGlassIcon className="size-4 shrink-0 text-[var(--text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-[var(--option-fg)] placeholder:text-[var(--control-fg-placeholder)] outline-none"
          />
        </div>
        {/* Options list */}
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--text-secondary)]">{emptyMessage}</div>
          ) : (
            filteredOptions.map((option, index) => {
              const optionValue = getOptionValue(option)
              return (
                <div
                  key={optionValue}
                  data-highlighted={index === highlightedIndex ? '' : undefined}
                  onClick={() => {
                    onValueChange(optionValue)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className="select-item-custom cursor-pointer"
                >
                  {getOptionLabel(option)}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
