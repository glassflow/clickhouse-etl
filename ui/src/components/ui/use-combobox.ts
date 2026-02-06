'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

export interface UseComboboxOptions<T> {
  /** The list of items to navigate through */
  items: T[]
  /** Callback when an item is selected */
  onSelect: (item: T) => void
}

export interface UseComboboxReturn {
  /** Whether the combobox is open */
  open: boolean
  /** Set the open state */
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  /** Current search value */
  search: string
  /** Set the search value */
  setSearch: React.Dispatch<React.SetStateAction<string>>
  /** Currently highlighted item index */
  highlightedIndex: number
  /** Set the highlighted index */
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>
  /** Ref for the trigger button */
  triggerRef: React.RefObject<HTMLButtonElement | null>
  /** Ref for the search input */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Measured trigger width for dropdown min-width */
  triggerWidth: number | undefined
  /** Keyboard event handler for the search input */
  handleKeyDown: (e: React.KeyboardEvent) => void
  /** Handler for onOpenAutoFocus to focus the search input */
  handleOpenAutoFocus: (e: Event) => void
}

/**
 * Hook to manage combobox state and keyboard navigation.
 * Extracts shared logic from FieldSelectCombobox and FunctionSelectCombobox.
 */
export function useCombobox<T>({ items, onSelect }: UseComboboxOptions<T>): UseComboboxReturn {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Measure trigger width and reset state when opening
  useEffect(() => {
    if (!open) return
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.getBoundingClientRect().width)
    }
    setSearch('')
    setHighlightedIndex(0)
  }, [open])

  // Reset highlighted index when items list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [items.length])

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (items.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev + 1) % items.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev - 1 + items.length) % items.length)
          break
        case 'Enter':
          e.preventDefault()
          if (items[highlightedIndex]) {
            onSelect(items[highlightedIndex])
            setOpen(false)
          }
          break
        case 'Escape':
          setOpen(false)
          break
      }
    },
    [items, highlightedIndex, onSelect],
  )

  // Focus input when popover opens (use with PopoverContent onOpenAutoFocus)
  const handleOpenAutoFocus = useCallback((e: Event) => {
    e.preventDefault()
    inputRef.current?.focus()
  }, [])

  return {
    open,
    setOpen,
    search,
    setSearch,
    highlightedIndex,
    setHighlightedIndex,
    triggerRef,
    inputRef,
    triggerWidth,
    handleKeyDown,
    handleOpenAutoFocus,
  }
}
