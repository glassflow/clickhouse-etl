'use client'

import { useCallback, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import {
  ArithmeticExpressionNode,
  ArithmeticOperand,
  ArithmeticOperator,
  isArithmeticExpressionNode,
} from '@/src/store/filter.store'
import { arithmeticExpressionToExpr, isNumericType } from '../utils'
import { cn } from '@/src/utils/common.client'

// Available arithmetic operators
const ARITHMETIC_OPERATORS: { value: ArithmeticOperator; label: string }[] = [
  { value: '+', label: '+' },
  { value: '-', label: '-' },
  { value: '*', label: '×' },
  { value: '/', label: '÷' },
  { value: '%', label: '%' },
]

interface ArithmeticComposerProps {
  expression: ArithmeticExpressionNode | undefined
  availableFields: Array<{ name: string; type: string }>
  onChange: (expression: ArithmeticExpressionNode) => void
  onClear?: () => void
  disabled?: boolean
  error?: string
}

/**
 * Component for building arithmetic expressions like (price + discount - 5)
 */
export function ArithmeticComposer({
  expression,
  availableFields,
  onChange,
  onClear,
  disabled = false,
  error,
}: ArithmeticComposerProps) {
  // Filter to only show numeric fields
  const numericFields = useMemo(() => {
    return availableFields.filter((f) => isNumericType(f.type))
  }, [availableFields])

  // Initialize expression if not set
  const currentExpression = useMemo((): ArithmeticExpressionNode => {
    if (expression) return expression
    return {
      id: uuidv4(),
      left: { type: 'field', field: '', fieldType: '' },
      operator: '+',
      right: { type: 'literal', value: 0 },
    }
  }, [expression])

  // Update left operand
  const handleLeftChange = useCallback(
    (operand: ArithmeticOperand) => {
      onChange({
        ...currentExpression,
        left: operand,
      })
    },
    [currentExpression, onChange],
  )

  // Update right operand
  const handleRightChange = useCallback(
    (operand: ArithmeticOperand) => {
      onChange({
        ...currentExpression,
        right: operand,
      })
    },
    [currentExpression, onChange],
  )

  // Update operator
  const handleOperatorChange = useCallback(
    (operator: ArithmeticOperator) => {
      onChange({
        ...currentExpression,
        operator,
      })
    },
    [currentExpression, onChange],
  )

  // Add another operand (creates nested expression)
  const handleAddOperand = useCallback(() => {
    // Wrap current expression in a new expression with the current as left side
    const newExpression: ArithmeticExpressionNode = {
      id: uuidv4(),
      left: currentExpression,
      operator: '+',
      right: { type: 'literal', value: 0 },
    }
    onChange(newExpression)
  }, [currentExpression, onChange])

  // Remove the outermost operator (unwrap nested expression)
  const handleRemoveOperand = useCallback(() => {
    if (isArithmeticExpressionNode(currentExpression.left)) {
      // If left side is a nested expression, use it as the new root
      onChange(currentExpression.left)
    } else if (onClear) {
      // Otherwise clear the whole expression
      onClear()
    }
  }, [currentExpression, onChange, onClear])

  // Generate preview string
  const previewString = useMemo(() => {
    try {
      return arithmeticExpressionToExpr(currentExpression)
    } catch {
      return '(incomplete)'
    }
  }, [currentExpression])

  // Check if we can remove operands (has nested expression or can clear)
  const canRemove = isArithmeticExpressionNode(currentExpression.left) || onClear

  return (
    <div className="space-y-3">
      {/* Expression builder */}
      <div className="flex flex-wrap items-end gap-2">
        {/* Left operand */}
        <OperandInput
          operand={currentExpression.left}
          availableFields={numericFields}
          onChange={handleLeftChange}
          disabled={disabled}
          label="Left"
        />

        {/* Operator */}
        <div className="w-16">
          <Label className="text-xs text-content mb-1 block">Op</Label>
          <Select
            value={currentExpression.operator}
            onValueChange={(v) => handleOperatorChange(v as ArithmeticOperator)}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 input-regular input-border-regular">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="select-content-custom">
              {ARITHMETIC_OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value} className="select-item-custom">
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right operand */}
        <OperandInput
          operand={currentExpression.right}
          availableFields={numericFields}
          onChange={handleRightChange}
          disabled={disabled}
          label="Right"
        />

        {/* Add/Remove buttons */}
        <div className="flex gap-1 pb-0.5">
          <Button
            variant="outline"
            size="icon"
            onClick={handleAddOperand}
            disabled={disabled}
            className="h-10 w-10 btn-tertiary"
            title="Add another operand"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
          {canRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemoveOperand}
              disabled={disabled}
              className="h-10 w-10 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
              title="Remove operand"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)]">Preview:</span>
        <code className="text-xs font-mono px-2 py-1 bg-[var(--surface-bg-sunken)] rounded border border-[var(--surface-border)]">
          {previewString}
        </code>
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-[var(--color-foreground-critical)]">{error}</p>}
    </div>
  )
}

/**
 * Input component for a single operand (field or literal)
 */
interface OperandInputProps {
  operand: ArithmeticOperand | ArithmeticExpressionNode
  availableFields: Array<{ name: string; type: string }>
  onChange: (operand: ArithmeticOperand) => void
  disabled?: boolean
  label: string
}

function OperandInput({ operand, availableFields, onChange, disabled = false, label }: OperandInputProps) {
  // All hooks must be called before any early returns
  // Handle type toggle
  const handleTypeChange = useCallback(
    (newType: 'field' | 'literal') => {
      if (newType === 'field') {
        onChange({ type: 'field', field: '', fieldType: '' })
      } else {
        onChange({ type: 'literal', value: 0 })
      }
    },
    [onChange],
  )

  // Handle field selection
  const handleFieldChange = useCallback(
    (fieldName: string | null) => {
      if (!fieldName) return
      const field = availableFields.find((f) => f.name === fieldName)
      if (field) {
        onChange({ type: 'field', field: field.name, fieldType: field.type })
      }
    },
    [availableFields, onChange],
  )

  // Handle literal value change
  const handleValueChange = useCallback(
    (value: string) => {
      const numValue = parseFloat(value) || 0
      onChange({ type: 'literal', value: numValue })
    },
    [onChange],
  )

  // If the operand is a nested expression, show a preview instead of inputs
  if (isArithmeticExpressionNode(operand)) {
    const preview = arithmeticExpressionToExpr(operand)
    return (
      <div className="min-w-[120px]">
        <Label className="text-xs text-content mb-1 block">{label}</Label>
        <div className="h-10 flex items-center px-3 bg-[var(--surface-bg-sunken)] rounded-md border border-[var(--surface-border)]">
          <code className="text-xs font-mono text-[var(--text-secondary)] truncate">{preview}</code>
        </div>
      </div>
    )
  }

  const isField = operand.type === 'field'

  return (
    <div className="flex gap-1 items-end">
      {/* Type selector */}
      <div className="w-20">
        <Label className="text-xs text-content mb-1 block">{label}</Label>
        <Select
          value={operand.type}
          onValueChange={(v) => handleTypeChange(v as 'field' | 'literal')}
          disabled={disabled}
        >
          <SelectTrigger className="h-10 input-regular input-border-regular text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="select-content-custom">
            <SelectItem value="field" className="select-item-custom">
              Field
            </SelectItem>
            <SelectItem value="literal" className="select-item-custom">
              Value
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Value input based on type */}
      {isField ? (
        <div className="min-w-[140px]">
          <Label className="text-xs text-content mb-1 block opacity-0">Field</Label>
          <SearchableSelect
            availableOptions={availableFields.map((f) => f.name)}
            selectedOption={operand.field || undefined}
            onSelect={handleFieldChange}
            placeholder="Select field..."
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="w-24">
          <Label className="text-xs text-content mb-1 block opacity-0">Value</Label>
          <Input
            type="number"
            value={operand.value}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="0"
            disabled={disabled}
            className="h-10 input-regular input-border-regular"
          />
        </div>
      )}
    </div>
  )
}

export default ArithmeticComposer
