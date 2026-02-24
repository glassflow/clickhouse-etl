'use client'

import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { cn } from '@/src/utils/common.client'
import { createPortal } from 'react-dom'

interface DualSearchableSelectProps {
  primaryOptions: string[]
  secondaryOptions: string[]
  selectedOption?: string
  onSelect: (option: string | null, source: 'primary' | 'secondary') => void
  placeholder?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
  primaryLabel?: string
  secondaryLabel?: string
  sourceTopic?: string
  open?: boolean
  onOpenChange?: (isOpen: boolean) => void
  /** Error message; when set, shows error styling on the input (message is typically rendered by parent). */
  error?: string
}

export function DualSearchableSelect({
  primaryOptions,
  secondaryOptions,
  selectedOption,
  onSelect,
  placeholder = 'Select an option',
  className,
  disabled = false,
  clearable = true,
  primaryLabel = 'Primary Fields',
  secondaryLabel = 'Secondary Fields',
  sourceTopic,
  open: controlledOpen,
  onOpenChange,
  error,
}: DualSearchableSelectProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState({ list: 'primary' as 'primary' | 'secondary', index: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const primaryListRef = useRef<HTMLDivElement>(null)
  const secondaryListRef = useRef<HTMLDivElement>(null)

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

  const [filteredPrimaryOptions, setFilteredPrimaryOptions] = useState<string[]>([])
  const [filteredSecondaryOptions, setFilteredSecondaryOptions] = useState<string[]>([])
  const [dropdownPosition, setDropdownPosition] = useState<'above' | 'below'>('below')
  const [dropdownCoordinates, setDropdownCoordinates] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )
  const [initialPlacement, setInitialPlacement] = useState<'above' | 'below' | null>(null)

  // Update search when selectedOption changes
  useEffect(() => {
    if (selectedOption) {
      setSearch(selectedOption)
    } else {
      setSearch('')
    }
  }, [selectedOption])

  // Update filtered options when search changes
  useEffect(() => {
    const filteredPrimary = primaryOptions.filter((option) => option.toLowerCase().includes(search.toLowerCase()))
    const filteredSecondary = secondaryOptions.filter((option) => option.toLowerCase().includes(search.toLowerCase()))

    setFilteredPrimaryOptions(filteredPrimary)
    setFilteredSecondaryOptions(filteredSecondary)

    // Reset highlighted index when options change
    if (filteredPrimary.length > 0) {
      setHighlightedIndex({ list: 'primary', index: 0 })
    } else if (filteredSecondary.length > 0) {
      setHighlightedIndex({ list: 'secondary', index: 0 })
    }
  }, [search, primaryOptions, secondaryOptions])

  // Update dropdown position when container position changes
  useEffect(() => {
    if (!open || !containerRef.current) return

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      // Calculate actual dropdown height based on filtered options
      const itemHeight = 32 // Approximate height per item (py-1.5 + text + margins)
      const headerHeight = 40 // Height of "Left Topic" and "Right Topic" headers
      const padding = 16 // p-4 padding on each side
      const separatorHeight = 32 // Height of vertical separator with my-4

      const maxPrimaryItems = Math.min(filteredPrimaryOptions.length, 9) // Roughly 300px / 32px
      const maxSecondaryItems = Math.min(filteredSecondaryOptions.length, 9)

      const primaryHeight = Math.min(
        filteredPrimaryOptions.length * itemHeight + padding * 2,
        300, // max-h-[300px] from CSS
      )
      const secondaryHeight = Math.min(
        filteredSecondaryOptions.length * itemHeight + padding * 2,
        300, // max-h-[300px] from CSS
      )

      const actualDropdownHeight = Math.max(primaryHeight, secondaryHeight) + headerHeight + padding

      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top

      // For initial placement decision, use max possible height to avoid placement changes during filtering
      const maxPossibleDropdownHeight = 300 + headerHeight + padding // max-h-[300px] + headers + padding
      const spaceNeeded = maxPossibleDropdownHeight + 20 // Add some padding
      const margin = 8 // Margin between dropdown and input

      // Determine placement: lock it on first calculation, only recalculate on position changes (not content changes)
      let position: 'above' | 'below'
      if (initialPlacement === null) {
        // First time opening - determine optimal placement using max height
        position = spaceBelow < spaceNeeded && spaceAbove >= spaceNeeded ? 'above' : 'below'
        setInitialPlacement(position)
      } else {
        // Use locked placement during filtering
        position = initialPlacement
      }
      setDropdownPosition(position)

      // Update coordinates for proper positioning
      setDropdownCoordinates({
        top: position === 'above' ? rect.top - actualDropdownHeight - margin : rect.bottom + 4,
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
  }, [open, filteredPrimaryOptions.length, filteredSecondaryOptions.length])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    const currentList = highlightedIndex.list
    const currentOptions = currentList === 'primary' ? filteredPrimaryOptions : filteredSecondaryOptions
    const otherList = currentList === 'primary' ? 'secondary' : 'primary'
    const otherOptions = otherList === 'primary' ? filteredPrimaryOptions : filteredSecondaryOptions

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (highlightedIndex.index < currentOptions.length - 1) {
          setHighlightedIndex({ ...highlightedIndex, index: highlightedIndex.index + 1 })
        } else if (otherOptions.length > 0) {
          setHighlightedIndex({ list: otherList, index: 0 })
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (highlightedIndex.index > 0) {
          setHighlightedIndex({ ...highlightedIndex, index: highlightedIndex.index - 1 })
        } else if (otherOptions.length > 0) {
          setHighlightedIndex({ list: otherList, index: otherOptions.length - 1 })
        }
        break

      case 'Enter':
        e.preventDefault()
        const selectedList = highlightedIndex.list
        const options = selectedList === 'primary' ? filteredPrimaryOptions : filteredSecondaryOptions
        if (highlightedIndex.index >= 0 && highlightedIndex.index < options.length) {
          const selected = options[highlightedIndex.index]
          onSelect(selected, selectedList)
          setOpen(false)
        }
        break

      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)} onKeyDown={handleKeyDown}>
      <div className="flex items-center">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={search}
          error={!!error}
          onChange={(e) => {
            const value = e.target.value
            setSearch(value)
            setOpen(true)

            // Reset placement lock when search is cleared to allow repositioning
            if (value === '') {
              setInitialPlacement(null)
            }
          }}
          onClick={() => !disabled && setOpen(true)}
          className={cn(
            'w-full pr-10 text-content',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
          disabled={disabled}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
          {clearable && selectedOption && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-70 hover:opacity-100"
              onClick={() => {
                setSearch('')
                onSelect(null, 'primary')
              }}
              disabled={disabled}
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
            className={cn('h-4 w-4 opacity-50', disabled && 'cursor-not-allowed')}
            onClick={() => !disabled && setOpen(!open)}
          />
        </div>
      </div>

      {open &&
        !disabled &&
        dropdownCoordinates &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-50 shadow-md rounded-md overflow-hidden bg-[var(--color-black-300,#1e1e1f)] border border-[var(--color-border-regular,#373737)] flex"
            style={{
              top: dropdownCoordinates.top + 'px',
              left: dropdownCoordinates.left + 'px',
              width: Math.max(500, dropdownCoordinates.width) + 'px',
            }}
          >
            {/* Primary Options */}
            <div className="flex-1 p-4">
              <div>Left Topic</div>
              {/* <div className="p-2 text-sm font-medium text-muted-foreground border-b border-white/10">
                {primaryLabel}
              </div> */}
              <div className="max-h-[300px] overflow-auto p-1" ref={primaryListRef}>
                {filteredPrimaryOptions.length === 0 ? (
                  <div className="py-2 px-2 text-sm text-muted-foreground">No options found.</div>
                ) : (
                  <div className="space-y-1">
                    {filteredPrimaryOptions.map((option, index) => (
                      <div
                        key={option}
                        className={cn(
                          'flex w-full items-center px-2 py-1.5 text-sm outline-none cursor-pointer transition-all duration-150',
                          'text-[var(--option-fg)] hover:bg-[var(--option-bg-hover)] hover:text-[var(--option-fg-highlighted)]',
                          selectedOption === option &&
                            'bg-[var(--option-bg-selected)] text-[var(--option-fg-selected)]',
                          highlightedIndex.list === 'primary' &&
                            highlightedIndex.index === index &&
                            'bg-[var(--option-bg-highlighted)] text-[var(--option-fg-highlighted)]',
                        )}
                        onClick={() => {
                          onSelect(option, 'primary')
                          setOpen(false)
                        }}
                        onMouseEnter={() => setHighlightedIndex({ list: 'primary', index })}
                      >
                        <span className="flex-1">{option}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Vertical Separator */}
            <div className="w-px bg-white/10 my-4" />

            {/* Secondary Options */}
            <div className="flex-1 p-4">
              <div>Right Topic</div>
              {/* <div className="p-2 text-sm font-medium text-muted-foreground border-b border-white/10">
                {secondaryLabel}:
              </div> */}
              <div className="max-h-[300px] overflow-auto p-1" ref={secondaryListRef}>
                {filteredSecondaryOptions.length === 0 ? (
                  <div className="py-2 px-2 text-sm text-muted-foreground">No options found.</div>
                ) : (
                  <div className="space-y-1">
                    {filteredSecondaryOptions.map((option, index) => (
                      <div
                        key={option}
                        className={cn(
                          'flex w-full items-center px-2 py-1.5 text-sm outline-none cursor-pointer transition-all duration-150',
                          'text-[var(--option-fg)] hover:bg-[var(--option-bg-hover)] hover:text-[var(--option-fg-highlighted)]',
                          selectedOption === option &&
                            'bg-[var(--option-bg-selected)] text-[var(--option-fg-selected)]',
                          highlightedIndex.list === 'secondary' &&
                            highlightedIndex.index === index &&
                            'bg-[var(--option-bg-highlighted)] text-[var(--option-fg-highlighted)]',
                        )}
                        onClick={() => {
                          onSelect(option, 'secondary')
                          setOpen(false)
                        }}
                        onMouseEnter={() => setHighlightedIndex({ list: 'secondary', index })}
                      >
                        <span className="flex-1">{option}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
