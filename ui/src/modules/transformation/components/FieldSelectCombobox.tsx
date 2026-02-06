'use client'

import * as React from 'react'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { useCombobox } from '@/src/components/ui/use-combobox'
import { cn } from '@/src/utils/common.client'

export interface FieldOption {
  name: string
  type: string
}

interface FieldSelectComboboxProps {
  value: string
  onValueChange: (value: string) => void
  availableFields: FieldOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean
  /** Filter fields by type (e.g. only string types for an arg) */
  filterTypes?: string[]
  /** Trigger class name (e.g. for width) */
  triggerClassName?: string
}

export function FieldSelectCombobox({
  value,
  onValueChange,
  availableFields,
  placeholder = 'Select field',
  disabled = false,
  className,
  error,
  filterTypes,
  triggerClassName,
}: FieldSelectComboboxProps) {
  // Filter by type first
  const filteredByType = React.useMemo(() => {
    if (!filterTypes?.length) return availableFields
    return availableFields.filter((f) => filterTypes.includes(f.type))
  }, [availableFields, filterTypes])

  // Use the shared combobox hook - we'll connect filteredFields after search
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
  } = useCombobox<FieldOption>({
    items: [], // We'll handle items manually since we need search filtering
    onSelect: (field) => onValueChange(field.name),
  })

  // Filter by search
  const filteredFields = React.useMemo(() => {
    if (!search) return filteredByType
    const s = search.toLowerCase()
    return filteredByType.filter((f) => f.name.toLowerCase().includes(s) || f.type.toLowerCase().includes(s))
  }, [filteredByType, search])

  const selectedField = filteredByType.find((f) => f.name === value)

  // Reset highlighted index when filtered list changes
  React.useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredFields.length, setHighlightedIndex])

  // Custom keyboard handler that uses filteredFields
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredFields.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev + 1) % filteredFields.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev - 1 + filteredFields.length) % filteredFields.length)
          break
        case 'Enter':
          e.preventDefault()
          if (filteredFields[highlightedIndex]) {
            onValueChange(filteredFields[highlightedIndex].name)
            setOpen(false)
          }
          break
        case 'Escape':
          setOpen(false)
          break
      }
    },
    [filteredFields, highlightedIndex, onValueChange, setHighlightedIndex, setOpen],
  )

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
          <span className="truncate">
            {selectedField ? (
              <>
                <span>{selectedField.name}</span>
                <span className="ml-2 text-[var(--text-secondary)]">({selectedField.type})</span>
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="select-content-custom p-0"
        align="start"
        style={triggerWidth !== undefined ? { minWidth: triggerWidth } : undefined}
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
            placeholder="Search fields..."
            className="flex-1 bg-transparent text-sm text-[var(--option-fg)] placeholder:text-[var(--control-fg-placeholder)] outline-none"
          />
        </div>
        {/* Options list */}
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filteredFields.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--text-secondary)]">No field found.</div>
          ) : (
            filteredFields.map((f, index) => (
              <div
                key={f.name}
                data-highlighted={index === highlightedIndex ? '' : undefined}
                onClick={() => {
                  onValueChange(f.name)
                  setOpen(false)
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className="select-item-custom cursor-pointer"
              >
                <span>{f.name}</span>
                <span className="ml-2 text-[var(--text-secondary)]">({f.type})</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
