'use client'

import React, { useCallback } from 'react'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Switch } from '@/src/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { TransformArithmeticExpression, TransformArithmeticOperator } from '@/src/store/transformation.store'
import { cn } from '@/src/utils/common.client'

interface ArithmeticModifierProps {
  enabled: boolean
  expression?: TransformArithmeticExpression
  onEnabledChange: (enabled: boolean) => void
  onExpressionChange: (expression: TransformArithmeticExpression | undefined) => void
  disabled?: boolean
  error?: string
}

const ARITHMETIC_OPERATORS: { value: TransformArithmeticOperator; label: string }[] = [
  { value: '*', label: '× (multiply)' },
  { value: '/', label: '÷ (divide)' },
  { value: '+', label: '+ (add)' },
  { value: '-', label: '− (subtract)' },
  { value: '%', label: '% (modulo)' },
]

export function ArithmeticModifier({
  enabled,
  expression,
  onEnabledChange,
  onExpressionChange,
  disabled = false,
  error,
}: ArithmeticModifierProps) {
  // Handle toggle
  const handleToggle = useCallback(
    (checked: boolean) => {
      onEnabledChange(checked)
      if (checked && !expression) {
        // Initialize with default multiplication
        onExpressionChange({ operator: '*', operand: 1 })
      } else if (!checked) {
        onExpressionChange(undefined)
      }
    },
    [expression, onEnabledChange, onExpressionChange],
  )

  // Handle operator change
  const handleOperatorChange = useCallback(
    (operator: string) => {
      onExpressionChange({
        operator: operator as TransformArithmeticOperator,
        operand: expression?.operand ?? 1,
      })
    },
    [expression, onExpressionChange],
  )

  // Handle operand change
  const handleOperandChange = useCallback(
    (value: string) => {
      const numValue = parseFloat(value) || 0
      onExpressionChange({
        operator: expression?.operator ?? '*',
        operand: numValue,
      })
    },
    [expression, onExpressionChange],
  )

  return (
    <div className="space-y-2">
      {/* Toggle row */}
      <div className="flex items-center gap-3">
        <Switch
          id="arithmetic-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={disabled}
          className="data-[state=checked]:bg-[var(--color-background-primary)]"
        />
        <Label htmlFor="arithmetic-toggle" className="text-xs text-[var(--text-secondary)] cursor-pointer">
          Apply arithmetic operation
        </Label>
      </div>

      {/* Arithmetic inputs */}
      {enabled && (
        <div className="flex items-end gap-2 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
          {/* Operator select */}
          <div className="w-32">
            <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Operator</Label>
            <Select value={expression?.operator || '*'} onValueChange={handleOperatorChange} disabled={disabled}>
              <SelectTrigger className="input-regular input-border-regular">
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

          {/* Operand input */}
          <div className="flex-1">
            <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Value</Label>
            <Input
              // type="number"
              value={expression?.operand ?? ''}
              onChange={(e) => handleOperandChange(e.target.value)}
              placeholder="Enter number"
              disabled={disabled}
              className={cn('input-regular input-border-regular', error && 'border-[var(--color-border-critical)]')}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-[var(--color-foreground-critical)] ml-6">{error}</p>}
    </div>
  )
}

export default ArithmeticModifier
