'use client'

import React, { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import {
  TRANSFORMATION_FUNCTIONS,
  getCategories,
  getFunctionsByCategory,
  getCategoryLabel,
  FunctionCategory,
  TransformationFunctionDef,
} from '../functions'
import { cn } from '@/src/utils/common.client'

interface FunctionSelectorProps {
  value: string
  onSelect: (functionName: string) => void
  disabled?: boolean
  error?: string
  className?: string
  // Optional filter function to customize available functions
  filterFunctions?: (functions: TransformationFunctionDef[]) => TransformationFunctionDef[]
}

export function FunctionSelector({
  value,
  onSelect,
  disabled = false,
  error,
  className,
  filterFunctions,
}: FunctionSelectorProps) {
  // Get filtered functions if filter is provided
  const availableFunctions = useMemo(() => {
    if (filterFunctions) {
      return filterFunctions(TRANSFORMATION_FUNCTIONS)
    }
    return TRANSFORMATION_FUNCTIONS
  }, [filterFunctions])

  // Get all categories from available functions
  const categories = useMemo(() => {
    const cats = [...new Set(availableFunctions.map((fn) => fn.category))]
    return cats as FunctionCategory[]
  }, [availableFunctions])

  // Group functions by category
  const functionsByCategory = useMemo(() => {
    const grouped: Record<FunctionCategory, TransformationFunctionDef[]> = {} as any
    categories.forEach((cat) => {
      grouped[cat] = availableFunctions.filter((fn) => fn.category === cat)
    })
    return grouped
  }, [categories, availableFunctions])

  // Get the selected function's display info
  const selectedFunction = useMemo(() => {
    return availableFunctions.find((f) => f.name === value)
  }, [value, availableFunctions])

  return (
    <Select value={value} onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'input-regular input-border-regular',
          className || 'w-full',
          error && 'border-[var(--color-border-critical)]',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <SelectValue placeholder="Select function">
          {selectedFunction && (
            <span className="flex items-center gap-2">
              <span>{selectedFunction.name}</span>
              <span className="text-xs text-[var(--text-secondary)]">→ {selectedFunction.returnType}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="select-content-custom max-h-[400px]">
        {categories.map((category) => (
          <SelectGroup key={category}>
            <SelectLabel className="text-xs font-semibold text-[var(--text-secondary)] px-2 py-1.5 bg-[var(--surface-bg-sunken)]">
              {getCategoryLabel(category)}
            </SelectLabel>
            {functionsByCategory[category].map((func) => (
              <SelectItem key={func.name} value={func.name} className="select-item-custom">
                <div className="flex flex-col py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{func.name}</span>
                    <span className="text-xs text-[var(--color-foreground-primary)]">→ {func.returnType}</span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{func.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

export default FunctionSelector
