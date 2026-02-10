'use client'

import { useCallback, useState, useMemo } from 'react'
import {
  TransformationField,
  FunctionArg,
  ExpressionMode,
  TransformArithmeticExpression,
} from '@/src/store/transformation.store'
import { FieldValidation } from '../utils'
import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'
import { FunctionSelector } from './FunctionSelector'
import { Input } from '@/src/components/ui/input'
import { TransformationFunctionDef } from '../functions'
import { FieldSelectCombobox } from './FieldSelectCombobox'
import { ExpressionModeToggle } from './ExpressionModeToggle'
import { NestedFunctionComposer } from './NestedFunctionComposer'
import { RawExpressionEditor } from './RawExpressionEditor'
import { ArithmeticModifier } from './ArithmeticModifier'
import { cn } from '@/src/utils/common.client'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'

interface TransformFunctionSelectProps {
  field: TransformationField
  handleFunctionChange: (value: string) => void
  readOnly: boolean
  errors: FieldValidation['errors']
  availableFields: Array<{ name: string; type: string }>
  functionDef: TransformationFunctionDef
  getArgValue: (argIndex: number) => string
  handleArgChange: (argIndex: number, value: string, argType: 'field' | 'literal' | 'array') => void
  // New props for extended functionality
  onExpressionModeChange?: (mode: ExpressionMode) => void
  onFunctionArgsChange?: (args: FunctionArg[]) => void
  onRawExpressionChange?: (expression: string) => void
  onArithmeticChange?: (arithmetic: TransformArithmeticExpression | undefined) => void
}

function TransformFunctionSelect({
  field,
  handleFunctionChange,
  readOnly,
  errors,
  availableFields,
  functionDef,
  getArgValue,
  handleArgChange,
  onExpressionModeChange,
  onFunctionArgsChange,
  onRawExpressionChange,
  onArithmeticChange,
}: TransformFunctionSelectProps) {
  const expressionMode = field.expressionMode || 'nested'

  // State for tracking the function expression from NestedFunctionComposer
  const [functionExpression, setFunctionExpression] = useState('')

  // State for copy-to-clipboard feedback
  const [copied, setCopied] = useState(false)

  // Handle expression change from NestedFunctionComposer
  const handleFunctionExpressionChange = useCallback((expr: string) => {
    setFunctionExpression(expr)
  }, [])

  // Build the full expression including arithmetic
  const fullExpression = useMemo(() => {
    if (expressionMode === 'raw') {
      return field.rawExpression || ''
    }

    let expr = functionExpression
    if (!expr) return ''

    // Add arithmetic modifier if present
    if (field.arithmeticExpression) {
      expr = `${expr} ${field.arithmeticExpression.operator} ${field.arithmeticExpression.operand}`
    }

    return expr
  }, [functionExpression, field.arithmeticExpression, field.rawExpression, expressionMode])

  // Copy expression to clipboard
  const handleCopyExpression = useCallback(async () => {
    if (!fullExpression) return

    try {
      await navigator.clipboard.writeText(fullExpression)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy expression:', err)
    }
  }, [fullExpression])

  // Handle mode change
  const handleModeChange = useCallback(
    (mode: ExpressionMode) => {
      if (onExpressionModeChange) {
        onExpressionModeChange(mode)
      }
    },
    [onExpressionModeChange],
  )

  // Handle function args change for nested mode
  const handleNestedArgsChange = useCallback(
    (args: FunctionArg[]) => {
      if (onFunctionArgsChange) {
        onFunctionArgsChange(args)
      }
    },
    [onFunctionArgsChange],
  )

  // Handle raw expression change
  const handleRawChange = useCallback(
    (expression: string) => {
      if (onRawExpressionChange) {
        onRawExpressionChange(expression)
      }
    },
    [onRawExpressionChange],
  )

  // Handle arithmetic enabled/expression change
  const handleArithmeticEnabledChange = useCallback(
    (enabled: boolean) => {
      if (onArithmeticChange) {
        if (!enabled) {
          onArithmeticChange(undefined)
        }
      }
    },
    [onArithmeticChange],
  )

  const handleArithmeticExprChange = useCallback(
    (arithmetic: TransformArithmeticExpression | undefined) => {
      if (onArithmeticChange) {
        onArithmeticChange(arithmetic)
      }
    },
    [onArithmeticChange],
  )

  // Render simple mode (original behavior) - COMMENTED OUT: Using nested mode for all function-based transformations
  const renderSimpleMode = ({ className }: { className?: string }) => (
    <div className="flex gap-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
      <div className={cn('flex-1', className)}>
        <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Function</Label>
        <FunctionSelector
          value={field.functionName || ''}
          onSelect={handleFunctionChange}
          disabled={readOnly}
          error={errors?.functionName}
          className="w-full"
        />
        {errors?.functionName && (
          <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{errors.functionName}</p>
        )}
      </div>

      <div className="border-[var(--surface-border)] flex-1">
        <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Arguments</Label>
        <div className="flex gap-2">
          {functionDef.args.map((argDef, argIndex) => (
            <div key={argIndex} className="flex-1 gap-2 items-center">
              {argDef.type === 'field' ? (
                <div className="flex-1">
                  <FieldSelectCombobox
                    value={getArgValue(argIndex)}
                    onValueChange={(v) => handleArgChange(argIndex, v, 'field')}
                    availableFields={availableFields}
                    placeholder="Select field"
                    disabled={readOnly}
                    filterTypes={argDef.fieldTypes}
                    triggerClassName="h-8 text-sm w-full"
                  />
                </div>
              ) : (
                <div className="flex-1">
                  <Input
                    value={getArgValue(argIndex)}
                    onChange={(e) => handleArgChange(argIndex, e.target.value, 'literal')}
                    placeholder={argDef.description}
                    disabled={readOnly}
                    className="flex-1 input-regular input-border-regular h-8 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
          {errors?.functionArgs && (
            <p className="text-xs text-[var(--color-foreground-critical)]">{errors.functionArgs}</p>
          )}
        </div>
      </div>
    </div>
  )

  // Render nested mode
  const renderNestedMode = () => (
    <div className="space-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
      <NestedFunctionComposer
        functionName={field.functionName || ''}
        functionArgs={field.functionArgs || []}
        availableFields={availableFields}
        onFunctionChange={handleFunctionChange}
        onArgsChange={handleNestedArgsChange}
        onExpressionChange={handleFunctionExpressionChange}
        disabled={readOnly}
        error={errors?.functionName}
        hidePreview={true} // Hide internal preview - we'll show unified preview below
      />
    </div>
  )

  // Render raw expression mode
  const renderRawMode = () => (
    <div className="space-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
      <RawExpressionEditor
        expression={field.rawExpression || ''}
        availableFields={availableFields}
        onChange={handleRawChange}
        disabled={readOnly}
        error={errors?.rawExpression}
      />
    </div>
  )

  // Check if extended mode handlers are available
  const hasExtendedHandlers = onExpressionModeChange && onFunctionArgsChange && onRawExpressionChange

  return (
    <div className="space-y-4">
      {/* Expression mode toggle - only show if handlers are provided */}
      {/* {hasExtendedHandlers && (
        <div className="flex items-center gap-4">
          <ExpressionModeToggle mode={expressionMode} onChange={handleModeChange} disabled={readOnly} />
        </div>
      )} */}

      {/* Render content based on mode */}
      {/* Simple mode - COMMENTED OUT: Using nested mode for all function-based transformations */}
      {/* {expressionMode === 'simple' && renderSimpleMode({ className: 'w-1/2' })} */}
      {/* Nested mode - handles both single and multiple functions */}
      {(expressionMode === 'simple' || expressionMode === 'nested') && hasExtendedHandlers && renderNestedMode()}
      {expressionMode === 'raw' && hasExtendedHandlers && renderRawMode()}

      {/* Arithmetic modifier - only for nested mode (which replaces simple mode) with extended handlers */}
      {hasExtendedHandlers && onArithmeticChange && expressionMode !== 'raw' && (
        <ArithmeticModifier
          enabled={!!field.arithmeticExpression}
          expression={field.arithmeticExpression}
          onEnabledChange={handleArithmeticEnabledChange}
          onExpressionChange={handleArithmeticExprChange}
          disabled={readOnly}
          error={errors?.arithmeticExpression}
        />
      )}

      {/* Unified Expression Preview with Copy Button */}
      {fullExpression && (
        <div className="space-y-2 pt-2 border-t border-[var(--surface-border)]">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-[var(--text-secondary)] font-medium">Full Expression Preview</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyExpression}
              className={cn(
                'h-7 px-2 text-xs',
                copied
                  ? 'text-[var(--color-foreground-positive)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
              title="Copy expression to clipboard"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-3.5 w-3.5 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <code className="block text-sm font-mono p-3 bg-[var(--color-bg-accent-muted)] text-[var(--text-accent)] rounded-[var(--radius-medium)] border border-[var(--color-border-accent)] break-all">
            {fullExpression}
          </code>
          {field.arithmeticExpression && (
            <p className="text-xs text-[var(--text-secondary)]">
              Includes arithmetic operation: {field.arithmeticExpression.operator} {field.arithmeticExpression.operand}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default TransformFunctionSelect
