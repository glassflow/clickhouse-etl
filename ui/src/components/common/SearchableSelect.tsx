'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { Label } from '@/src/components/ui/label'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { cn } from '@/src/utils/common.client'
import { createPortal } from 'react-dom'

interface SearchableSelectProps {
  availableOptions: string[]
  selectedOption?: string
  onSelect: (option: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
  open?: boolean
  onOpenChange?: (isOpen: boolean) => void
  readOnly?: boolean
  label?: string
  error?: string
  /** When true (default), reserves space for error message to prevent layout shift. Set false in table/row layouts where parent handles validation. */
  reserveErrorSpace?: boolean
}

export function SearchableSelect({
  availableOptions,
  selectedOption,
  onSelect,
  placeholder = 'Select an option',
  className,
  disabled = false,
  clearable = true,
  open: controlledOpen,
  onOpenChange,
  readOnly,
  label,
  error,
  reserveErrorSpace = true,
}: SearchableSelectProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [filteredOptions, setFilteredOptions] = useState<string[]>([])
  const [availableKeys, setAvailableKeys] = useState<string[]>([])
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const [dropdownPlacement, setDropdownPlacement] = useState<'above' | 'below'>('below')
  const [initialPlacement, setInitialPlacement] = useState<'above' | 'below' | null>(null)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value)
    } else {
      setUncontrolledOpen(value)
    }

    // Reset placement lock when dropdown closes
    if (!value) {
      setInitialPlacement(null)
    }
  }

  // Update search when selectedOption changes
  useEffect(() => {
    if (selectedOption) {
      setSearch(selectedOption)
    } else {
      setSearch('')
    }
  }, [selectedOption])

  // Update filtered options when search or availableOptions change
  useEffect(() => {
    if (availableOptions.length === 0) {
      return
    }
    const filtered = availableOptions.filter((option) => option.toLowerCase().includes(search.toLowerCase()))
    setFilteredOptions(filtered)

    // Reset highlighted index when options change
    if (filtered.length > 0) {
      setHighlightedIndex(0)
    }
  }, [search, availableOptions.length])

  // Update dropdown position when container position changes
  useEffect(() => {
    if (!open || !inputWrapperRef.current) return

    const updatePosition = () => {
      const rect = inputWrapperRef.current?.getBoundingClientRect()
      if (!rect) return

      // Calculate actual dropdown height based on filtered options
      const itemHeight = 32 // Approximate height per item (py-1.5 + text + margins)
      const padding = 8 // p-1 padding
      const actualDropdownHeight = Math.min(
        filteredOptions.length * itemHeight + padding * 2,
        200, // max-h-[200px] from CSS
      )

      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top

      // For initial placement decision, use max height to avoid placement changes during filtering
      const maxDropdownHeight = 200
      const spaceNeeded = maxDropdownHeight + 20 // Add some padding

      // Determine placement: lock it on first calculation, only recalculate on position changes (not content changes)
      let placement: 'above' | 'below'
      if (initialPlacement === null) {
        // First time opening - determine optimal placement using max height
        placement = spaceBelow < spaceNeeded && spaceAbove >= spaceNeeded ? 'above' : 'below'
        setInitialPlacement(placement)
      } else {
        // Use locked placement during filtering
        placement = initialPlacement
      }
      setDropdownPlacement(placement)

      setDropdownPosition({
        top: placement === 'above' ? rect.top - actualDropdownHeight - 4 : rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      })
    }

    // Initial position
    updatePosition()

    // Update position on scroll and resize
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, filteredOptions.length])

  // Handle clicks outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside the dropdown
      const dropdownElement = document.getElementById('searchable-select-dropdown')
      const isClickInDropdown = dropdownElement && dropdownElement.contains(event.target as Node)

      // Check if click is inside the container
      const isClickInContainer = containerRef.current && containerRef.current.contains(event.target as Node)

      // Close if click is outside both the dropdown and container
      if (!isClickInDropdown && !isClickInContainer) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    if (filteredOptions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prevIndex) => {
          const newIndex = (prevIndex + 1) % filteredOptions.length
          return newIndex
        })
        break

      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prevIndex) => {
          const newIndex = (prevIndex - 1 + filteredOptions.length) % filteredOptions.length
          return newIndex
        })
        break

      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          e.preventDefault()
          const selected = filteredOptions[highlightedIndex]
          onSelect(selected)
          setOpen(false)
        }
        break

      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break

      case 'Tab':
        setOpen(false)
        break
    }
  }

  // Scroll highlighted option into view
  useEffect(() => {
    if (open && listRef.current && filteredOptions.length > 0) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, open, filteredOptions.length])

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSearch('')
    onSelect(null)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearch(value)
    setOpen(true)

    // Reset placement lock when search is cleared to allow repositioning
    if (value === '') {
      setInitialPlacement(null)
    }

    if (value === '' && selectedOption) {
      onSelect(null)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)} onKeyDown={handleKeyDown}>
      <div className="flex items-center">
        <div className="flex flex-col items-left gap-2 w-full">
          {label && <span className="text-sm text-content">{label}</span>}
          <div ref={inputWrapperRef} className="relative w-full">
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={handleInputChange}
              onClick={() => !disabled && !readOnly && setOpen(true)}
              onFocus={() => !disabled && !readOnly && setOpen(true)}
              error={!!error}
              readOnly={readOnly}
              className="w-full pr-10 text-content"
              disabled={disabled}
              aria-expanded={open}
              aria-controls="searchable-select-dropdown"
              role="combobox"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              {clearable && selectedOption && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-70 hover:opacity-100"
                  onClick={handleClear}
                  disabled={disabled}
                  aria-label="Clear selection"
                >
                  <span className="sr-only">Clear</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </Button>
              )}
              <ChevronDownIcon
                className={cn('h-4 w-4 opacity-50 cursor-pointer', disabled && 'cursor-not-allowed')}
                onClick={() => !disabled && setOpen(!open)}
                aria-hidden="true"
              />
            </div>
          </div>
          {reserveErrorSpace && (
            /* Error message display - min height + clamp so long errors do not overlap following rows */
            <p
              className={cn(
                'text-sm mt-1 min-h-5 break-words line-clamp-2',
                error ? 'input-description-error' : 'invisible',
              )}
            >
              {error || 'Placeholder'}
            </p>
          )}
        </div>
      </div>

      {open &&
        !disabled &&
        typeof window !== 'undefined' &&
        dropdownPosition &&
        createPortal(
          <div
            id="searchable-select-dropdown"
            className="fixed z-50 shadow-md rounded-md border overflow-hidden select-content-custom"
            style={{
              width: dropdownPosition.width + 'px',
              top: dropdownPosition.top + 'px',
              left: dropdownPosition.left + 'px',
            }}
            role="listbox"
          >
            <div className="max-h-[200px] overflow-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-2 px-2 text-sm text-muted-foreground">No options found.</div>
              ) : (
                <div ref={listRef} className="space-y-1">
                  {filteredOptions.map((option, index) => (
                    <div
                      key={option}
                      role="option"
                      aria-selected={selectedOption === option}
                      className={cn(
                        'flex w-full items-center px-2 py-1.5 text-sm outline-none cursor-pointer transition-all duration-150',
                        'hover:bg-accent hover:text-accent-foreground',
                        selectedOption === option && 'bg-accent/50',
                        highlightedIndex === index
                          ? 'bg-primary/20 font-medium text-[var(--color-background-primary)]'
                          : 'rounded-md',
                      )}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onSelect(option)
                        setOpen(false)
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
