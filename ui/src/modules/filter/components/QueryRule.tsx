'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { Switch } from '@/src/components/ui/switch'
import { TrashIcon, CalculatorIcon } from '@heroicons/react/24/outline'
import {
  FilterRule,
  FilterOperator,
  ArithmeticExpressionNode,
  createEmptyArithmeticExpression,
} from '@/src/store/filter.store'
import { SelectEnhanced } from '@/src/components/common/SelectEnhanced'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import {
  getOperatorsForType,
  isNumericType,
  isBooleanType,
  parseValueForType,
  getDefaultValueForType,
  isNoValueOperator,
  isArrayValueOperator,
  getArithmeticExpressionType,
  FILTER_OPERATORS,
  RuleValidation,
} from '../utils'
import { cn } from '@/src/utils/common.client'
import { ArithmeticComposer } from './ArithmeticComposer'

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
      if (
        newValue === '' ||
        newValue === '-' ||
        newValue === '.' ||
        newValue === '-.' ||
        /^-?\d*\.?\d*$/.test(newValue)
      ) {
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
      className={cn('h-10 input-regular input-border-regular', hasError && 'input-border-error', className)}
    />
  )
}

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
  // Check if using arithmetic expression mode
  const isExpressionMode = rule.useArithmeticExpression || false

  // Get available operators based on selected field type or expression mode
  const availableOperators = useMemo(() => {
    if (isExpressionMode) {
      // For arithmetic expressions, only numeric comparison operators make sense
      const numericType = getArithmeticExpressionType()
      return getOperatorsForType(numericType)
    }
    if (!rule.fieldType) return []
    return getOperatorsForType(rule.fieldType)
  }, [rule.fieldType, isExpressionMode])

  // Convert operators for SelectEnhanced
  const operatorOptions = useMemo(() => {
    return availableOperators.map((op) => ({
      label: op.label,
      value: op.value,
    }))
  }, [availableOperators])

  // Check if there are numeric fields available (for arithmetic mode)
  const hasNumericFields = useMemo(() => {
    return availableFields.some((f) => isNumericType(f.type))
  }, [availableFields])

  // Handle NOT toggle
  const handleNotToggle = useCallback(
    (checked: boolean) => {
      onChange(rule.id, { not: checked })
      onTouched?.(rule.id)
    },
    [rule.id, onChange, onTouched],
  )

  // Handle expression mode toggle
  const handleExpressionModeToggle = useCallback(
    (checked: boolean) => {
      onTouched?.(rule.id)
      if (checked) {
        // Switch to expression mode
        const defaultExpr = createEmptyArithmeticExpression()
        const numericType = getArithmeticExpressionType()
        const validOperators = getOperatorsForType(numericType)
        const defaultOperator = validOperators.length > 0 ? validOperators[0].value : 'eq'

        onChange(rule.id, {
          useArithmeticExpression: true,
          arithmeticExpression: defaultExpr,
          field: '', // Clear simple field
          fieldType: numericType,
          operator: defaultOperator,
          value: 0,
        })
      } else {
        // Switch to simple mode
        onChange(rule.id, {
          useArithmeticExpression: false,
          arithmeticExpression: undefined,
          field: '',
          fieldType: '',
          operator: 'eq',
          value: '',
        })
      }
    },
    [rule.id, onChange, onTouched],
  )

  // Handle arithmetic expression change
  const handleArithmeticExpressionChange = useCallback(
    (expression: ArithmeticExpressionNode) => {
      onTouched?.(rule.id)
      onChange(rule.id, { arithmeticExpression: expression })
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

  // Determine effective field type (for expression mode, it's always numeric)
  const effectiveFieldType = isExpressionMode ? getArithmeticExpressionType() : rule.fieldType

  // Render value input based on field type and operator
  const renderValueInput = () => {
    // No value input needed for null check operators
    if (isNoValueOperator(rule.operator)) {
      return (
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-content mb-1 block">Value</Label>
          <div className="h-10 flex items-center text-sm text-[var(--text-secondary)] italic">No value needed</div>
          <div className="h-5 mt-0.5" />
        </div>
      )
    }

    // For expression mode, always show numeric input
    if (isExpressionMode) {
      // Array value input for in/notIn operators (comma-separated, don't use NumericValueInput)
      if (isArrayValueOperator(rule.operator)) {
        return (
          <div>
            <Label className="text-xs text-content mb-1 block">Values (comma-separated)</Label>
            <div className="space-y-0">
              <Input
                type="text"
                value={String(rule.value ?? '')}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="e.g., 1, 2, 3"
                disabled={readOnly}
                className={cn('h-10 input-regular input-border-regular', validation?.value && 'input-border-error')}
              />
              <div className="h-5 mt-0.5">
                {validation?.value && <p className="input-description-error text-sm">{validation.value}</p>}
              </div>
            </div>
          </div>
        )
      }

      // Single numeric value - use NumericValueInput to support floats
      return (
        <div>
          <Label className="text-xs text-content mb-1 block">Value</Label>
          <div className="space-y-0">
            <NumericValueInput
              value={rule.value}
              onChange={handleValueChange}
              placeholder="Enter a value"
              disabled={readOnly}
              hasError={!!validation?.value}
            />
            <div className="h-5 mt-0.5">
              {validation?.value && <p className="input-description-error text-sm">{validation.value}</p>}
            </div>
          </div>
        </div>
      )
    }

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

    // Array value input for in/notIn operators
    if (isArrayValueOperator(rule.operator)) {
      return (
        <div>
          <Label className="text-xs text-content mb-1 block">Values (comma-separated)</Label>
          <div className="space-y-0">
            <Input
              type="text"
              value={String(rule.value ?? '')}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={isNumericType(effectiveFieldType) ? 'e.g., 1, 2, 3' : 'e.g., active, pending'}
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

    if (isBooleanType(effectiveFieldType)) {
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

    // For numeric types, use NumericValueInput to properly handle float typing
    if (isNumericType(effectiveFieldType)) {
      return (
        <div>
          <Label className="text-xs text-content mb-1 block">Value</Label>
          <div className="space-y-0">
            <NumericValueInput
              value={rule.value}
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
        <Label className="text-xs text-content mb-1 block">Value</Label>
        <div className="space-y-0">
          <Input
            type="text"
            value={rule.value === '' ? '' : String(rule.value ?? '')}
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

  // Determine if operator selector should be enabled
  const isOperatorEnabled = isExpressionMode || !!rule.field

  return (
    <div
      className={cn(
        'card-outline rounded-[var(--radius-large)] p-3',
        rule.not && 'border-[var(--color-border-primary)] bg-[var(--color-background-primary-faded)]/10',
      )}
    >
      <div className="flex flex-col gap-2">
        {/* NOT toggle, Expression toggle, and delete button row */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-4">
            {/* NOT toggle */}
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

            {/* Expression mode toggle - only show if there are numeric fields */}
            {hasNumericFields && (
              <div className="flex items-center gap-2">
                <Switch
                  id={`rule-expr-${rule.id}`}
                  checked={isExpressionMode}
                  onCheckedChange={handleExpressionModeToggle}
                  disabled={readOnly}
                  className="data-[state=checked]:bg-[var(--color-background-primary)]"
                />
                <Label
                  htmlFor={`rule-expr-${rule.id}`}
                  className="text-xs text-[var(--text-secondary)] cursor-pointer flex items-center gap-1"
                >
                  <CalculatorIcon className="h-3.5 w-3.5" />
                  Expression
                </Label>
              </div>
            )}
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

        {/* Expression mode: Show ArithmeticComposer */}
        {isExpressionMode ? (
          <div className="space-y-3">
            {/* Arithmetic expression composer */}
            <ArithmeticComposer
              expression={rule.arithmeticExpression}
              availableFields={availableFields}
              onChange={handleArithmeticExpressionChange}
              disabled={readOnly}
              error={validation?.field || validation?.expression}
            />

            {/* Operator and Value row */}
            <div className="flex items-start gap-3">
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
                  disabled={readOnly}
                />
              </div>

              {/* Value Input */}
              <div className="flex-1 min-w-0">{renderValueInput()}</div>
            </div>
          </div>
        ) : (
          /* Simple mode: Field, Operator, Value row */
          <div className="flex items-start gap-3">
            {/* Field Select - wrapped to match SelectEnhanced structure */}
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-content mb-1 block">Field</Label>
              <div className="space-y-0">
                <SearchableSelect
                  availableOptions={availableFields.map((f) => f.name)}
                  selectedOption={rule.field || undefined}
                  onSelect={handleFieldChange}
                  placeholder="Select field..."
                  disabled={readOnly}
                  className={cn(validation?.field && '[&_input]:input-border-error')}
                />
                {/* Reserve space for error message to prevent layout shift */}
                <div className="h-5 mt-0.5">
                  {validation?.field && <p className="input-description-error text-sm">{validation.field}</p>}
                </div>
              </div>
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
                disabled={readOnly || !isOperatorEnabled}
              />
            </div>

            {/* Value Input */}
            <div className="flex-1 min-w-0">{renderValueInput()}</div>
          </div>
        )}
      </div>
    </div>
  )
}
