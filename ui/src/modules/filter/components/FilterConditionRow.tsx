'use client'

import { useCallback, useMemo } from 'react'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { TrashIcon } from '@heroicons/react/24/outline'
import { FilterCondition, FilterOperator } from '@/src/store/filter.store'
import {
  getOperatorsForType,
  isNumericType,
  isBooleanType,
  parseValueForType,
  getDefaultValueForType,
  ConditionValidation,
} from '../utils'

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

  // Handle field selection - using native select
  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const fieldName = e.target.value
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

  // Handle operator selection - using native select
  const handleOperatorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const operator = e.target.value
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
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(condition.id, { value: e.target.value === 'true' })
    },
    [condition.id, onChange],
  )

  // Render value input based on field type
  const renderValueInput = () => {
    if (!condition.field) {
      return <Input type="text" placeholder="Enter a value" disabled={true} className="h-10" />
    }

    if (isBooleanType(condition.fieldType)) {
      const boolValue = condition.value === true || condition.value === 'true' ? 'true' : 'false'
      return (
        <select
          value={boolValue}
          onChange={handleBooleanChange}
          disabled={readOnly}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      )
    }

    return (
      <Input
        type={isNumericType(condition.fieldType) ? 'number' : 'text'}
        value={String(condition.value ?? '')}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder="Enter a value"
        disabled={readOnly}
        className={`h-10 ${validation?.value ? 'border-red-500' : ''}`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-3">
        {/* Field Select - using native select to avoid Radix ref issues */}
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground mb-1 block">Field</Label>
          <select
            value={condition.field || ''}
            onChange={handleFieldChange}
            disabled={readOnly}
            className={`h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${validation?.field ? 'border-red-500' : ''}`}
          >
            <option value="">Select...</option>
            {availableFields.map((field) => (
              <option key={field.name} value={field.name}>
                {field.name} ({field.type})
              </option>
            ))}
          </select>
        </div>

        {/* Operator Select - using native select */}
        <div className="w-44">
          <Label className="text-xs text-muted-foreground mb-1 block">Condition</Label>
          <select
            value={condition.operator || ''}
            onChange={handleOperatorChange}
            disabled={readOnly || !condition.field}
            className={`h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${validation?.operator ? 'border-red-500' : ''}`}
          >
            <option value="">Select...</option>
            {availableOperators.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value Input */}
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground mb-1 block">Value</Label>
          {renderValueInput()}
        </div>

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(condition.id)}
          disabled={readOnly}
          className="h-10 w-10 flex-shrink-0 text-muted-foreground hover:text-destructive"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Validation errors */}
      {validation && Object.keys(validation).length > 0 && (
        <div className="text-xs text-red-500 pl-1">{validation.field || validation.operator || validation.value}</div>
      )}
    </div>
  )
}
