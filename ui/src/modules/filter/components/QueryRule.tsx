'use client'

import { useCallback, useMemo } from 'react'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { Switch } from '@/src/components/ui/switch'
import { TrashIcon } from '@heroicons/react/24/outline'
import { FilterRule, FilterOperator } from '@/src/store/filter.store'
import { SelectEnhanced } from '@/src/components/common/SelectEnhanced'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import {
  getOperatorsForType,
  isNumericType,
  isBooleanType,
  parseValueForType,
  getDefaultValueForType,
  RuleValidation,
} from '../utils'
import { cn } from '@/src/utils/common.client'

interface QueryRuleProps {
  rule: FilterRule
  availableFields: Array<{ name: string; type: string }>
  onChange: (id: string, updates: Partial<Omit<FilterRule, 'id' | 'type'>>) => void
  onRemove: (id: string) => void
  onTouched?: (id: string) => void
  validation?: RuleValidation['errors']
  readOnly?: boolean
  depth?: number
}

export function QueryRule({
  rule,
  availableFields,
  onChange,
  onRemove,
  onTouched,
  validation,
  readOnly = false,
  depth = 0,
}: QueryRuleProps) {
  // Get available operators based on selected field type
  const availableOperators = useMemo(() => {
    if (!rule.fieldType) return []
    return getOperatorsForType(rule.fieldType)
  }, [rule.fieldType])

  // Convert operators for SelectEnhanced
  const operatorOptions = useMemo(() => {
    return availableOperators.map((op) => ({
      label: op.label,
      value: op.value,
    }))
  }, [availableOperators])

  // Handle NOT toggle
  const handleNotToggle = useCallback(
    (checked: boolean) => {
      onChange(rule.id, { not: checked })
      onTouched?.(rule.id)
    },
    [rule.id, onChange, onTouched],
  )

  // Handle field selection
  const handleFieldChange = useCallback(
    (fieldName: string | null) => {
      onTouched?.(rule.id)
      if (!fieldName) return

      const field = availableFields.find((f) => f.name === fieldName)
      if (field) {
        // Reset operator and value when field changes
        const defaultValue = getDefaultValueForType(field.type)
        const validOperators = getOperatorsForType(field.type)
        const defaultOperator = validOperators.length > 0 ? validOperators[0].value : 'eq'

        onChange(rule.id, {
          field: field.name,
          fieldType: field.type,
          operator: defaultOperator,
          value: defaultValue,
        })
      }
    },
    [rule.id, availableFields, onChange, onTouched],
  )

  // Handle operator selection
  const handleOperatorChange = useCallback(
    (operator: string) => {
      onTouched?.(rule.id)
      if (operator) {
        onChange(rule.id, { operator: operator as FilterOperator })
      }
    },
    [rule.id, onChange, onTouched],
  )

  // Handle value change
  const handleValueChange = useCallback(
    (inputValue: string) => {
      onTouched?.(rule.id)
      const parsedValue = parseValueForType(inputValue, rule.fieldType)
      onChange(rule.id, { value: parsedValue })
    },
    [rule.id, rule.fieldType, onChange, onTouched],
  )

  // Handle boolean value change
  const handleBooleanChange = useCallback(
    (value: string) => {
      onTouched?.(rule.id)
      onChange(rule.id, { value: value === 'true' })
    },
    [rule.id, onChange, onTouched],
  )

  // Render value input based on field type
  const renderValueInput = () => {
    if (!rule.field) {
      return (
        <div>
          <Label className="text-xs text-content mb-1 block">Value</Label>
          <div className="h-5 mt-0.5">
            <Input type="text" placeholder="Enter a value" disabled={true} className="h-10 input-regular" />
          </div>
        </div>
      )
    }

    if (isBooleanType(rule.fieldType)) {
      const boolValue = rule.value === true || rule.value === 'true' ? 'true' : 'false'
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

    return (
      <div>
        <Label className="text-xs text-content mb-1 block">Value</Label>
        <div className="space-y-0">
          <Input
            type={isNumericType(rule.fieldType) ? 'number' : 'text'}
            value={String(rule.value ?? '')}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Enter a value"
            disabled={readOnly}
            className={cn('h-10 input-regular input-border-regular', validation?.value && 'input-border-error')}
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
    <div
      className={cn(
        'card-outline rounded-[var(--radius-medium)] p-3',
        rule.not && 'border-[var(--color-border-primary)] bg-[var(--color-background-primary-faded)]/10',
      )}
    >
      <div className="flex flex-col gap-2">
        {/* NOT toggle and delete button row */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Switch
              id={`rule-not-${rule.id}`}
              checked={rule.not || false}
              onCheckedChange={handleNotToggle}
              disabled={readOnly}
              className="data-[state=checked]:bg-[var(--color-background-primary)]"
            />
            <Label htmlFor={`rule-not-${rule.id}`} className="text-xs text-[var(--text-secondary)] cursor-pointer">
              NOT
            </Label>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(rule.id)}
            disabled={readOnly}
            className="h-8 w-8 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Rule inputs row */}
        <div className="flex items-start gap-3">
          {/* Field Select */}
          <div className="flex-1 min-w-0">
            <SearchableSelect
              label="Field"
              availableOptions={availableFields.map((f) => f.name)}
              selectedOption={rule.field || undefined}
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
              defaultValue={rule.operator || ''}
              onSelect={handleOperatorChange}
              isLoading={false}
              error={validation?.operator || ''}
              options={operatorOptions}
              placeholder="Select..."
              disabled={readOnly || !rule.field}
            />
          </div>

          {/* Value Input */}
          <div className="flex-1 min-w-0">{renderValueInput()}</div>
        </div>
      </div>
    </div>
  )
}
