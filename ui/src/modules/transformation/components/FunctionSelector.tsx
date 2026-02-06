'use client'

import React, { useMemo } from 'react'
import { TRANSFORMATION_FUNCTIONS, TransformationFunctionDef } from '../functions'
import { FunctionSelectCombobox } from './FunctionSelectCombobox'
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
  const availableFunctions = useMemo(() => {
    if (filterFunctions) {
      return filterFunctions(TRANSFORMATION_FUNCTIONS)
    }
    return TRANSFORMATION_FUNCTIONS
  }, [filterFunctions])

  return (
    <FunctionSelectCombobox
      value={value}
      onSelect={onSelect}
      availableFunctions={availableFunctions}
      disabled={disabled}
      error={Boolean(error)}
      className={cn(className, 'w-full')}
    />
  )
}

export default FunctionSelector
