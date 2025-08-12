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
  }

  const [filteredPrimaryOptions, setFilteredPrimaryOptions] = useState<string[]>([])
  const [filteredSecondaryOptions, setFilteredSecondaryOptions] = useState<string[]>([])
  const [dropdownPosition, setDropdownPosition] = useState<'above' | 'below'>('below')

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

      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const dropdownHeight = 300 // Approximate height of the dropdown
      const spaceNeeded = dropdownHeight + 20 // Add some padding

      // Position above if there's not enough space below
      setDropdownPosition(spaceBelow < spaceNeeded ? 'above' : 'below')
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
  }, [open])

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
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onClick={() => !disabled && setOpen(true)}
          className={cn(
            'w-full pr-10 input-regular input-border-regular text-content',
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

      {open && !disabled && (
        <div
          className={cn('absolute z-50 w-full', dropdownPosition === 'above' ? 'bottom-full mb-1' : 'top-full mt-1')}
        >
          <div className="min-w-[500px] shadow-md rounded-md overflow-hidden bg-[#1e1e1f] flex">
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
                          'flex w-full items-center px-2 py-1.5 text-sm outline-none cursor-pointer transition-all duration-150 text-content',
                          'hover:bg-accent hover:text-accent-foreground',
                          selectedOption === option && 'bg-accent/50',
                          highlightedIndex.list === 'primary' && highlightedIndex.index === index && 'bg-primary/20',
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
                          'flex w-full items-center px-2 py-1.5 text-sm outline-none cursor-pointer transition-all duration-150 text-content',
                          'hover:bg-accent hover:text-accent-foreground',
                          selectedOption === option && 'bg-accent/50',
                          highlightedIndex.list === 'secondary' && highlightedIndex.index === index && 'bg-primary/20',
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
          </div>
        </div>
      )}
    </div>
  )
}
