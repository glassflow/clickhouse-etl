'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { TrashIcon } from '@heroicons/react/24/outline'
import { FilterCondition, FilterOperator } from '@/src/store/filter.store'
import { SelectEnhanced } from '@/src/components/common/SelectEnhanced'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import {
  getOperatorsForType,
  isNumericType,
  isBooleanType,
  parseValueForType,
  getDefaultValueForType,
  ConditionValidation,
} from '../utils'
import { cn } from '@/src/utils/common.client'

/**
 * Numeric input component that properly handles float typing
 * by maintaining local string state to preserve intermediate states like "3." or "-"
 */
interface NumericValueInputProps {
  value: string | number | boolean
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  hasError?: boolean
}

function NumericValueInput({
  value,
  onChange,
  placeholder = 'Enter a value',
  disabled = false,
  className,
  hasError = false,
}: NumericValueInputProps) {
  // Local state to track the input string while typing (allows intermediate states like "3." or "-")
  const [inputValue, setInputValue] = useState<string>(() => {
    return value === '' ? '' : String(value ?? '')
  })

  // Sync input value when external value changes
  useEffect(() => {
    const externalStr = value === '' ? '' : String(value ?? '')
    // Only update if the numeric value actually changed (not just formatting)
    // This prevents overwriting intermediate states like "3." with "3"
    const currentNum = parseFloat(inputValue)
    const externalNum = parseFloat(externalStr)
    
    // Handle empty string case
    if (externalStr === '' && inputValue !== '') {
      setInputValue('')
      return
    }
    
    // Handle NaN cases (intermediate states like "." or "-")
    if (isNaN(currentNum) && !isNaN(externalNum)) {
      setInputValue(externalStr)
      return
    }
    
    // Only sync if the numeric values are different
    if (!isNaN(currentNum) && !isNaN(externalNum) && currentNum !== externalNum) {
      setInputValue(externalStr)
    }
  }, [value, inputValue])

  // Handle value change - preserve string while typing to support floats
  const handleValueChange = useCallback(
    (newValue: string) => {
      // Allow empty string, decimal points in progress (e.g., "3.", ".5"), and negative signs
      if (newValue === '' || newValue === '-' || newValue === '.' || newValue === '-.' || /^-?\d*\.?\d*$/.test(newValue)) {
        setInputValue(newValue)
        onChange(newValue)
      }
    },
    [onChange],
  )

  return (
    <Input
      type="text"
      value={inputValue}
      onChange={(e) => handleValueChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      error={hasError}
      className={cn('h-10', className)}
    />
  )
}

interface FilterConditionRowProps {
  condition: FilterCondition
  availableFields: Array<{ name: string; type: string }>
  onChange: (id: string, updates: Partial<FilterCondition>) => void
  onRemove: (id: string) => void
  validation?: ConditionValidation['errors']
  readOnly?: boolean
  isFirst?: boolean
}

export function FilterConditionRow({
  condition,
  availableFields,
  onChange,
  onRemove,
  validation,
  readOnly = false,
  isFirst = false,
}: FilterConditionRowProps) {
  // Get available operators based on selected field type
  const availableOperators = useMemo(() => {
    if (!condition.fieldType) return []
    return getOperatorsForType(condition.fieldType)
  }, [condition.fieldType])

  // Convert operators for SelectEnhanced
  const operatorOptions = useMemo(() => {
    return availableOperators.map((op) => ({
      label: op.label,
      value: op.value,
    }))
  }, [availableOperators])

  // Handle field selection
  const handleFieldChange = useCallback(
    (fieldName: string | null) => {
      if (!fieldName) return

      const field = availableFields.find((f) => f.name === fieldName)
      if (field) {
        // Reset operator and value when field changes
        const defaultValue = getDefaultValueForType(field.type)
        const validOperators = getOperatorsForType(field.type)
        const defaultOperator = validOperators.length > 0 ? validOperators[0].value : 'eq'

        onChange(condition.id, {
          field: field.name,
          fieldType: field.type,
          operator: defaultOperator,
          value: defaultValue,
        })
      }
    },
    [condition.id, availableFields, onChange],
  )

  // Handle operator selection
  const handleOperatorChange = useCallback(
    (operator: string) => {
      if (operator) {
        onChange(condition.id, { operator: operator as FilterOperator })
      }
    },
    [condition.id, onChange],
  )

  // Handle value change
  const handleValueChange = useCallback(
    (inputValue: string) => {
      const parsedValue = parseValueForType(inputValue, condition.fieldType)
      onChange(condition.id, { value: parsedValue })
    },
    [condition.id, condition.fieldType, onChange],
  )

  // Handle boolean value change
  const handleBooleanChange = useCallback(
    (value: string) => {
      onChange(condition.id, { value: value === 'true' })
    },
    [condition.id, onChange],
  )

  // Render value input based on field type
  const renderValueInput = () => {
    if (!condition.field) {
      return (
        <div>
          <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Value</Label>
          <div className="h-5 mt-0.5">
            <Input type="text" placeholder="Enter a value" disabled={true} className="h-10" />
          </div>
        </div>
      )
    }

    if (isBooleanType(condition.fieldType)) {
      const boolValue = condition.value === true || condition.value === 'true' ? 'true' : 'false'
      return (
        <SelectEnhanced
          label="Value"
          defaultValue={boolValue}
          onSelect={handleBooleanChange}
          isLoading={false}
          error={validation?.value || ''}
          options={[
            { label: 'true', value: 'true' },
            { label: 'false', value: 'false' },
          ]}
          placeholder="Select value"
          disabled={readOnly}
        />
      )
    }

    // For numeric types, use NumericValueInput to properly handle float typing
    if (isNumericType(condition.fieldType)) {
      return (
        <div>
          <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Value</Label>
          <div className="space-y-0">
            <NumericValueInput
              value={condition.value}
              onChange={handleValueChange}
              placeholder="Enter a value"
              disabled={readOnly}
              hasError={!!validation?.value}
            />
            {/* Reserve space for error message to prevent layout shift */}
            <div className="h-5 mt-0.5">
              {validation?.value && <p className="input-description-error text-sm">{validation.value}</p>}
            </div>
          </div>
        </div>
      )
    }

    // For string/other types, use regular Input
    return (
      <div>
        <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Value</Label>
        <div className="space-y-0">
          <Input
            type="text"
            value={String(condition.value ?? '')}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Enter a value"
            disabled={readOnly}
            error={!!validation?.value}
            className="h-10"
          />
          {/* Reserve space for error message to prevent layout shift */}
          <div className="h-5 mt-0.5">
            {validation?.value && <p className="input-description-error text-sm">{validation.value}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card-outline rounded-[var(--radius-md)] p-3">
      <div className="flex items-start gap-3">
        {/* Field Select */}
        <div className="flex-1 min-w-0">
          <SearchableSelect
            label="Field"
            availableOptions={availableFields.map((f) => f.name)}
            selectedOption={condition.field || undefined}
            onSelect={handleFieldChange}
            placeholder="Select field..."
            disabled={readOnly}
            error={validation?.field}
          />
        </div>

        {/* Operator Select */}
        <div className="w-48">
          <SelectEnhanced
            label="Condition"
            defaultValue={condition.operator || ''}
            onSelect={handleOperatorChange}
            isLoading={false}
            error={validation?.operator || ''}
            options={operatorOptions}
            placeholder="Select..."
            disabled={readOnly || !condition.field}
          />
        </div>

        {/* Value Input */}
        <div className="flex-1 min-w-0">{renderValueInput()}</div>

        {/* Remove Button */}
        <div className="pt-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(condition.id)}
            disabled={readOnly}
            className="h-10 w-10 flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
