'use client'

import * as React from 'react'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { useCombobox } from '@/src/components/ui/use-combobox'
import {
  TransformationFunctionDef,
  FunctionCategory,
  getCategoryLabel,
} from '@/src/modules/transformation/functions'
import { cn } from '@/src/utils/common.client'

interface FunctionSelectComboboxProps {
  value: string
  onSelect: (functionName: string) => void
  availableFunctions: TransformationFunctionDef[]
  disabled?: boolean
  className?: string
  error?: boolean
  /** Trigger class name (e.g. for width) */
  triggerClassName?: string
}

export function FunctionSelectCombobox({
  value,
  onSelect,
  availableFunctions,
  disabled = false,
  className,
  error,
  triggerClassName,
}: FunctionSelectComboboxProps) {
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
  } = useCombobox<TransformationFunctionDef>({
    items: [], // We'll handle items manually since we need search filtering and grouping
    onSelect: (func) => onSelect(func.name),
  })

  const categories = React.useMemo(() => {
    return [...new Set(availableFunctions.map((fn) => fn.category))] as FunctionCategory[]
  }, [availableFunctions])

  // Filter functions by search
  const filteredFunctions = React.useMemo(() => {
    if (!search) return availableFunctions
    const s = search.toLowerCase()
    return availableFunctions.filter(
      (f) =>
        f.name.toLowerCase().includes(s) ||
        f.returnType.toLowerCase().includes(s) ||
        f.description.toLowerCase().includes(s),
    )
  }, [availableFunctions, search])

  // Group filtered functions by category (only categories with results)
  const filteredByCategory = React.useMemo(() => {
    const grouped: Record<FunctionCategory, TransformationFunctionDef[]> = {} as Record<
      FunctionCategory,
      TransformationFunctionDef[]
    >
    categories.forEach((cat) => {
      const funcs = filteredFunctions.filter((fn) => fn.category === cat)
      if (funcs.length > 0) {
        grouped[cat] = funcs
      }
    })
    return grouped
  }, [categories, filteredFunctions])

  const visibleCategories = Object.keys(filteredByCategory) as FunctionCategory[]

  // Flatten for keyboard navigation
  const flatList = React.useMemo(() => {
    return visibleCategories.flatMap((cat) => filteredByCategory[cat])
  }, [visibleCategories, filteredByCategory])

  // Precompute index map: function name -> flat index (fixes currentFlatIndex mutation)
  const functionIndexMap = React.useMemo(() => {
    const map = new Map<string, number>()
    flatList.forEach((func, index) => {
      map.set(func.name, index)
    })
    return map
  }, [flatList])

  const selectedFunction = availableFunctions.find((f) => f.name === value)

  // Reset highlighted index when filtered list changes
  React.useEffect(() => {
    setHighlightedIndex(0)
  }, [flatList.length, setHighlightedIndex])

  // Custom keyboard handler that uses flatList
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (flatList.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev + 1) % flatList.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev - 1 + flatList.length) % flatList.length)
          break
        case 'Enter':
          e.preventDefault()
          if (flatList[highlightedIndex]) {
            onSelect(flatList[highlightedIndex].name)
            setOpen(false)
          }
          break
        case 'Escape':
          setOpen(false)
          break
      }
    },
    [flatList, highlightedIndex, onSelect, setHighlightedIndex, setOpen],
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
            {selectedFunction ? (
              <span className="flex items-center gap-2">
                <span>{selectedFunction.name}</span>
                <span className="text-xs text-[var(--text-secondary)]">→ {selectedFunction.returnType}</span>
              </span>
            ) : (
              'Select function'
            )}
          </span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="select-content-custom p-0"
        align="start"
        style={triggerWidth !== undefined ? { minWidth: Math.max(triggerWidth, 320) } : undefined}
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
            placeholder="Search functions..."
            className="flex-1 bg-transparent text-sm text-[var(--option-fg)] placeholder:text-[var(--control-fg-placeholder)] outline-none"
          />
        </div>
        {/* Options list */}
        <div className="max-h-[360px] overflow-y-auto">
          {flatList.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--text-secondary)]">No function found.</div>
          ) : (
            visibleCategories.map((category) => (
              <div key={category}>
                {/* Category header */}
                <div className="text-xs font-semibold text-[var(--text-secondary)] px-3 py-1.5 bg-[var(--surface-bg-sunken)] sticky top-0">
                  {getCategoryLabel(category)}
                </div>
                {/* Functions in category */}
                <div className="p-1">
                  {filteredByCategory[category].map((func) => {
                    // Use precomputed index map instead of mutating during render
                    const flatIndex = functionIndexMap.get(func.name) ?? 0
                    const isHighlighted = flatIndex === highlightedIndex
                    return (
                      <div
                        key={func.name}
                        data-highlighted={isHighlighted ? '' : undefined}
                        onClick={() => {
                          onSelect(func.name)
                          setOpen(false)
                        }}
                        onMouseEnter={() => setHighlightedIndex(flatIndex)}
                        className="select-item-custom cursor-pointer flex flex-col items-start py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{func.name}</span>
                          <span className="text-xs text-[var(--color-foreground-primary)]">→ {func.returnType}</span>
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]">{func.description}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
