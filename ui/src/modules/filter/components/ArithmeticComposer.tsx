'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import { Button } from '@/src/components/ui/button'
import { PlusIcon, TrashIcon, WrenchScrewdriverIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import {
  ArithmeticExpressionNode,
  ArithmeticOperand,
  ArithmeticOperator,
  isArithmeticExpressionNode,
} from '@/src/store/filter.store'
import { arithmeticExpressionToDisplayString, isNumericType } from '../utils'
import { parseArithmeticExpression } from '../parser/arithmeticParser'
import { cn } from '@/src/utils/common.client'
import { FieldValueToggle } from './FieldValueToggle'

// Available arithmetic operators with tooltips
const ARITHMETIC_OPERATORS: { value: ArithmeticOperator; label: string; tooltip: string }[] = [
  { value: '+', label: '+', tooltip: 'Add' },
  { value: '-', label: '-', tooltip: 'Subtract' },
  { value: '*', label: '×', tooltip: 'Multiply' },
  { value: '/', label: '÷', tooltip: 'Divide' },
  { value: '%', label: '%', tooltip: 'Modulo' },
]

// Editor mode type
type EditorMode = 'builder' | 'manual'

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
 * Supports two modes:
 * - Builder mode: Guided step-by-step expression building
 * - Manual mode: Direct text input for advanced users
 */
export function ArithmeticComposer({
  expression,
  availableFields,
  onChange,
  onClear,
  disabled = false,
  error,
}: ArithmeticComposerProps) {
  // Editor mode state
  const [mode, setMode] = useState<EditorMode>('builder')
  const [manualInput, setManualInput] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  // Filter to only show numeric fields (for builder dropdowns)
  const numericFields = useMemo(() => {
    return availableFields.filter((f) => isNumericType(f.type))
  }, [availableFields])

  // All field names: for manual expression parsing so e.g. int(event_id) % 2 is allowed
  const allFieldNames = useMemo(() => availableFields.map((f) => f.name), [availableFields])

  // Numeric field names only: for builder mode field dropdown
  const fieldNames = useMemo(() => numericFields.map((f) => f.name), [numericFields])

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

  // Sync manual input when expression changes externally (only in builder mode)
  useEffect(() => {
    if (mode === 'builder' && expression) {
      setManualInput(arithmeticExpressionToDisplayString(expression))
    }
  }, [expression, mode])

  // Detect if we're in chained mode (left operand is an expression node)
  const isChained = isArithmeticExpressionNode(currentExpression.left)

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return

      if (newMode === 'manual') {
        // Switching to manual mode - populate textarea with current expression
        setManualInput(arithmeticExpressionToDisplayString(currentExpression))
        setParseError(null)
        setMode('manual')
      } else {
        // Switching to builder mode - parse manual input
        if (!manualInput.trim()) {
          setParseError('Expression cannot be empty')
          return
        }

        const result = parseArithmeticExpression(manualInput.trim(), allFieldNames)
        if (result.success && result.expression) {
          onChange(result.expression)
          setParseError(null)
          setMode('builder')
        } else {
          setParseError(result.error || 'Failed to parse expression')
          // Don't switch mode on error
        }
      }
    },
    [mode, currentExpression, manualInput, allFieldNames, onChange],
  )

  // Handle manual input change
  const handleManualInputChange = useCallback((value: string) => {
    setManualInput(value)
    setParseError(null) // Clear error on input change
  }, [])

  // Apply manual expression (validate and update)
  const handleApplyManualExpression = useCallback(() => {
    if (!manualInput.trim()) {
      setParseError('Expression cannot be empty')
      return
    }

    const result = parseArithmeticExpression(manualInput.trim(), allFieldNames)
    if (result.success && result.expression) {
      onChange(result.expression)
      setParseError(null)
    } else {
      setParseError(result.error || 'Failed to parse expression')
    }
  }, [manualInput, allFieldNames, onChange])

  // Update left operand (only used in initial mode)
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

  // Check if we can remove operands (has nested expression or can clear)
  const canRemove = isArithmeticExpressionNode(currentExpression.left) || onClear

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <ModeToggle mode={mode} onChange={handleModeChange} disabled={disabled} hasParseError={!!parseError} />

      {/* Content based on mode */}
      {mode === 'manual' ? (
        // Manual mode: textarea input
        <ManualModeUI
          value={manualInput}
          onChange={handleManualInputChange}
          onApply={handleApplyManualExpression}
          disabled={disabled}
          error={parseError}
          placeholder="e.g., price + tax × 0.1"
        />
      ) : (
        // Builder mode: guided UI
        <div
          className={cn(
            'transition-all duration-300 ease-in-out',
            isChained ? 'flex flex-col gap-4' : 'flex flex-wrap items-stretch gap-3 max-w-full align-baseline',
          )}
        >
          {isChained ? (
            // Chained Layout: Current expression (readonly) + Next operation
            <>
              {/* Current expression preview */}
              <div className="transition-opacity duration-300 ease-in-out">
                <ExpressionPreview
                  expression={currentExpression.left as ArithmeticExpressionNode}
                  label="Current expression"
                />
              </div>

              {/* Next operation section */}
              <div className="transition-opacity duration-300 ease-in-out">
                <div className="flex flex-wrap items-stretch gap-3">
                  {/* Operator */}
                  <div className="w-32 flex flex-col">
                    <OperatorSelector
                      value={currentExpression.operator}
                      onChange={handleOperatorChange}
                      disabled={disabled}
                      label="Next operator"
                    />
                  </div>

                  {/* Next operand */}
                  <div className="flex-1 min-w-[200px] max-w-full flex flex-col">
                    <OperandInput
                      operand={currentExpression.right}
                      availableFields={numericFields}
                      onChange={handleRightChange}
                      disabled={disabled}
                      label="Next operand"
                    />
                  </div>

                  {/* Add/Remove buttons */}
                  <div className="flex gap-1 items-end pb-0.5">
                    <Button
                      size="icon"
                      onClick={handleAddOperand}
                      disabled={disabled}
                      variant="tertiary" className="h-10 w-10"
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
                        title="Remove last operation"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Initial Layout: Left | Operator | Right (symmetric)
            <>
              {/* Left operand */}
              <div className="flex-1 min-w-[200px] max-w-full flex flex-col transition-opacity duration-300 ease-in-out">
                <OperandInput
                  operand={currentExpression.left as ArithmeticOperand}
                  availableFields={numericFields}
                  onChange={handleLeftChange}
                  disabled={disabled}
                  label="Left operand"
                />
              </div>

              {/* Operator */}
              <div className="w-32 flex flex-col justify-end transition-opacity duration-300 ease-in-out">
                <OperatorSelector
                  value={currentExpression.operator}
                  onChange={handleOperatorChange}
                  disabled={disabled}
                  label="Operator"
                />
              </div>

              {/* Right operand */}
              <div className="flex-1 min-w-[200px] max-w-full flex flex-col transition-opacity duration-300 ease-in-out">
                <OperandInput
                  operand={currentExpression.right}
                  availableFields={numericFields}
                  onChange={handleRightChange}
                  disabled={disabled}
                  label="Right operand"
                />
              </div>

              {/* Add/Remove buttons */}
              <div className="flex gap-1 items-end pb-0.5 transition-opacity duration-300 ease-in-out">
                <Button
                  size="icon"
                  onClick={handleAddOperand}
                  disabled={disabled}
                  variant="tertiary" className="h-10 w-10"
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
            </>
          )}
        </div>
      )}

      {/* Error message (from parent) */}
      {error && <p className="text-sm text-[var(--color-foreground-critical)]">{error}</p>}
    </div>
  )
}

/**
 * Mode toggle between Builder and Manual modes
 */
interface ModeToggleProps {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
  disabled?: boolean
  hasParseError?: boolean
}

function ModeToggle({ mode, onChange, disabled = false, hasParseError = false }: ModeToggleProps) {
  const isBuilder = mode === 'builder'

  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-flex rounded-[var(--radius-xl)] border border-[var(--surface-border)] p-0.5 bg-[var(--surface-bg-sunken)]">
        {/* Sliding background indicator */}
        <div
          className="absolute top-0.5 bottom-0.5 rounded-[calc(var(--radius-md)-2px)] bg-[var(--option-bg-selected)] shadow-sm transition-all duration-300 ease-in-out"
          style={{
            left: isBuilder ? '0.125rem' : 'calc(50% + 0.0625rem)',
            right: isBuilder ? 'calc(50% + 0.0625rem)' : '0.125rem',
          }}
        />
        <button
          type="button"
          onClick={() => !disabled && onChange('builder')}
          disabled={disabled}
          className={cn(
            'relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[calc(var(--radius-md)-2px)] transition-colors duration-300 whitespace-nowrap',
            isBuilder ? 'text-[var(--text-accent)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-secondary)]',
            disabled && 'cursor-not-allowed opacity-50',
            !isBuilder && hasParseError && 'text-[var(--color-foreground-critical)]',
          )}
          title="Use guided expression builder"
        >
          <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
          Builder
        </button>
        <button
          type="button"
          onClick={() => !disabled && onChange('manual')}
          disabled={disabled}
          className={cn(
            'relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[calc(var(--radius-md)-2px)] transition-colors duration-300 whitespace-nowrap',
            !isBuilder ? 'text-[var(--text-accent)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-secondary)]',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          title="Enter expression manually (advanced)"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" />
          Manual
        </button>
      </div>
      {!isBuilder && <span className="text-[10px] text-[var(--text-disabled)] italic">Advanced</span>}
    </div>
  )
}

/**
 * Manual mode UI with textarea input
 */
interface ManualModeUIProps {
  value: string
  onChange: (value: string) => void
  onApply: () => void
  disabled?: boolean
  error?: string | null
  placeholder?: string
}

function ManualModeUI({ value, onChange, onApply, disabled = false, error, placeholder }: ManualModeUIProps) {
  // Handle Enter key to apply
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onApply()
      }
    },
    [onApply],
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">Expression</Label>
        <div className="flex gap-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={2}
            className={cn(
              'flex-1 font-mono text-sm resize-none',
              error && 'border-[var(--color-border-critical)] focus:border-[var(--color-border-critical)]',
            )}
          />
          <Button
            onClick={onApply}
            disabled={disabled || !value.trim()}
            variant="tertiary" className="h-auto self-stretch"
            title="Apply expression (Enter)"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Syntax help */}
      <div className="text-[10px] text-[var(--text-disabled)] space-y-0.5">
        <p>
          Use field names and operators: <code className="px-1 py-0.5 rounded bg-[var(--surface-bg-sunken)]">+</code>{' '}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-bg-sunken)]">-</code>{' '}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-bg-sunken)]">*</code>{' '}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-bg-sunken)]">/</code>{' '}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-bg-sunken)]">%</code>
        </p>
        <p>
          Use parentheses for grouping:{' '}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-bg-sunken)]">(a + b) * c</code>
        </p>
      </div>

      {/* Parse error */}
      {error && <p className="text-sm text-[var(--color-foreground-critical)]">{error}</p>}
    </div>
  )
}

/**
 * Read-only preview of the current expression (used in chained mode)
 */
interface ExpressionPreviewProps {
  expression: ArithmeticExpressionNode
  label: string
}

function ExpressionPreview({ expression, label }: ExpressionPreviewProps) {
  const preview = arithmeticExpressionToDisplayString(expression)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-[var(--text-secondary)]">{label}</Label>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-bg-sunken)] text-[var(--text-disabled)] font-medium uppercase tracking-wide">
          Expression
        </span>
      </div>
      <div className="h-10 flex items-center px-3 bg-[var(--surface-bg-sunken)] rounded-md border border-[var(--surface-border)] text-sm font-mono text-[var(--text-secondary)] overflow-x-auto whitespace-nowrap">
        {preview}
      </div>
    </div>
  )
}

/**
 * Operator selector with tooltips
 */
interface OperatorSelectorProps {
  value: ArithmeticOperator
  onChange: (operator: ArithmeticOperator) => void
  disabled?: boolean
  label: string
}

function OperatorSelector({ value, onChange, disabled = false, label }: OperatorSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-[var(--text-secondary)]">{label}</Label>
      <div className="relative inline-flex rounded-[var(--radius-xl)] border border-[var(--surface-border)] p-0.5 bg-[var(--surface-bg-sunken)] w-full h-10">
        <div className="flex-1 grid grid-cols-5 gap-0.5">
          {ARITHMETIC_OPERATORS.map((op) => (
            <button
              key={op.value}
              type="button"
              onClick={() => !disabled && onChange(op.value)}
              disabled={disabled}
              className={cn(
                'relative z-10 flex items-center justify-center px-1.5 py-1.5 text-sm font-medium rounded-[calc(var(--radius-md)-2px)] transition-colors duration-200',
                value === op.value
                  ? 'bg-[var(--option-bg-selected)] text-[var(--text-accent)]'
                  : 'text-[var(--text-disabled)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-bg)]',
                disabled && 'cursor-not-allowed opacity-50',
              )}
              title={op.tooltip}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Input component for a single operand (field or literal)
 * Can also display a nested expression as read-only preview
 */
interface OperandInputProps {
  operand: ArithmeticOperand | ArithmeticExpressionNode
  availableFields: Array<{ name: string; type: string }>
  onChange: (operand: ArithmeticOperand) => void
  disabled?: boolean
  label: string
}

function OperandInput({ operand, availableFields, onChange, disabled = false, label }: OperandInputProps) {
  // Local state to track the input string while typing (allows intermediate states like "3." or "-")
  const [inputValue, setInputValue] = useState<string>(() => {
    if (!isArithmeticExpressionNode(operand) && operand.type === 'literal') {
      return String(operand.value)
    }
    return '0'
  })

  // Sync input value when operand changes externally
  useEffect(() => {
    if (!isArithmeticExpressionNode(operand) && operand.type === 'literal') {
      // Only update if the numeric value actually changed (not just formatting)
      const currentNum = parseFloat(inputValue)
      if (isNaN(currentNum) || currentNum !== operand.value) {
        setInputValue(String(operand.value))
      }
    }
  }, [operand, inputValue])

  // Handle type toggle
  const handleTypeChange = useCallback(
    (newType: 'field' | 'literal') => {
      if (newType === 'field') {
        onChange({ type: 'field', field: '', fieldType: '' })
      } else {
        setInputValue('0')
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

  // Handle literal value change - preserve string while typing to support floats
  const handleValueChange = useCallback(
    (value: string) => {
      // Allow empty string, decimal points in progress (e.g., "3.", ".5"), and negative signs
      if (value === '' || value === '-' || value === '.' || value === '-.' || /^-?\d*\.?\d*$/.test(value)) {
        setInputValue(value)
        // Parse and store the numeric value (0 for incomplete inputs)
        const numValue = parseFloat(value)
        onChange({ type: 'literal', value: isNaN(numValue) ? 0 : numValue })
      }
    },
    [onChange],
  )

  // If the operand is a nested expression, show a preview instead of inputs
  // This shouldn't normally happen in our controlled flow, but handle it gracefully
  if (isArithmeticExpressionNode(operand)) {
    return <ExpressionPreview expression={operand} label={label} />
  }

  // If the operand is a function call, show it as read-only
  // Function calls can only be created in manual mode
  if (operand.type === 'function') {
    const funcDisplay = `${operand.functionName}(${operand.arguments.map((arg) => (arg.type === 'field' ? arg.field : arg.type === 'literal' ? String(arg.value) : '...')).join(', ')})`
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{label}</Label>
        <div className="h-10 flex items-center px-3 bg-[var(--surface-bg-sunken)] rounded-md border border-[var(--surface-border)] text-sm font-mono text-[var(--text-secondary)]">
          {funcDisplay}
        </div>
      </div>
    )
  }

  const isField = operand.type === 'field'

  return (
    <div className="flex flex-col gap-1.5">
      {/* Type toggle using FieldValueToggle */}
      <FieldValueToggle value={operand.type} onChange={handleTypeChange} disabled={disabled} label={label} />

      {/* Value input based on type - fixed height for alignment */}
      {isField ? (
        <SearchableSelect
          availableOptions={availableFields.map((f) => f.name)}
          selectedOption={operand.field || undefined}
          onSelect={handleFieldChange}
          placeholder="Select field..."
          disabled={disabled}
        />
      ) : (
        <Input
          value={inputValue}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder="0"
          disabled={disabled}
          className="h-10"
        />
      )}
    </div>
  )
}

export default ArithmeticComposer
