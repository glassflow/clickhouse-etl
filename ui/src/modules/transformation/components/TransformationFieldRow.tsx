'use client'

import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { TrashIcon, PencilIcon, ChevronUpIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  TransformationField,
  FunctionArg,
  FunctionArgField,
  ExpressionMode,
  TransformArithmeticExpression,
} from '@/src/store/transformation.store'
import { JSON_DATA_TYPES } from '@/src/config/constants'
import { FieldValidation, inferOutputType, normalizeToJsonDataType, createFieldArg, createLiteralArg } from '../utils'
import { getFunctionByName } from '../functions'
import { cn } from '@/src/utils/common.client'
import TypeToggle from './TypeToggle'
import SourceFieldSelect from './SourceFieldSelect'
import TransformFunctionSelect from './TransformFunctionSelect'
import { ExpressionModeToggle } from './ExpressionModeToggle'
import { ArithmeticModifier } from './ArithmeticModifier'

interface TransformationFieldRowProps {
  field: TransformationField
  availableFields: Array<{ name: string; type: string }>
  onUpdate: (fieldId: string, updates: Partial<Omit<TransformationField, 'id'>>) => void
  onRemove: (fieldId: string) => void
  errors?: FieldValidation['errors']
  readOnly?: boolean
  index: number
}

// Helper function to format a single waterfall slot for display
function formatWaterfallSlot(slot: import('@/src/store/transformation.store').WaterfallSlot): string {
  switch (slot.slotType) {
    case 'field':
      return slot.fieldName || '<field>'
    case 'literal':
      if (slot.literalType === 'number') {
        return slot.literalValue || '0'
      }
      return slot.literalValue ? `"${slot.literalValue}"` : '<value>'
    case 'function':
      if (!slot.functionName) return '<function>'
      const funcDef = getFunctionByName(slot.functionName)
      const args =
        slot.functionArgs
          ?.map((arg, idx) => {
            const argDef = funcDef?.args[idx]
            return formatFunctionArg(arg, argDef)
          })
          .join(', ') || ''
      return `${slot.functionName}(${args})`
    default:
      return '<expr>'
  }
}

// Helper function to format a single function argument for display
function formatFunctionArg(arg: FunctionArg, argDef?: { name: string }): string {
  if (arg.type === 'field') {
    if (arg.fieldName) return arg.fieldName
    return argDef?.name ? `<${argDef.name}>` : '<field>'
  }
  if (arg.type === 'literal') {
    if (arg.value !== undefined && arg.value !== '') return `"${arg.value}"`
    return argDef?.name ? `<${argDef.name}>` : '<value>'
  }
  if (arg.type === 'array') {
    if (arg.values && arg.values.length > 0) {
      const formattedValues = arg.values.map((v) => {
        if (typeof v === 'object' && v !== null && 'type' in v) {
          // It's a nested FunctionArg
          return formatFunctionArg(v as FunctionArg)
        }
        return String(v)
      })
      return `[${formattedValues.join(', ')}]`
    }
    return argDef?.name ? `<${argDef.name}>` : '<array>'
  }
  if (arg.type === 'nested_function') {
    // Recursively format nested function
    if (arg.functionName) {
      const nestedFuncDef = getFunctionByName(arg.functionName)
      const nestedArgs =
        arg.functionArgs
          ?.map((nestedArg, idx) => {
            const nestedArgDef = nestedFuncDef?.args[idx]
            return formatFunctionArg(nestedArg, nestedArgDef)
          })
          .join(', ') || ''
      return `${arg.functionName}(${nestedArgs})`
    }
    return argDef?.name ? `<${argDef.name}>` : '<function>'
  }
  if (arg.type === 'waterfall_array') {
    // Format waterfall array slots
    if (arg.slots && arg.slots.length > 0) {
      const formattedSlots = arg.slots.map(formatWaterfallSlot)
      return `[${formattedSlots.join(', ')}]`
    }
    return argDef?.name ? `<${argDef.name}>` : '<expressions>'
  }
  return '<arg>'
}

// Helper function to format function expression for display
function formatFunctionExpression(field: TransformationField): string {
  // Raw expression mode
  if (field.expressionMode === 'raw' && field.rawExpression) {
    // Truncate if too long
    const maxLen = 50
    if (field.rawExpression.length > maxLen) {
      return field.rawExpression.substring(0, maxLen) + '...'
    }
    return field.rawExpression
  }

  // Nested/function mode
  if (field.functionName) {
    // Get function definition to show argument names as placeholders
    const funcDef = getFunctionByName(field.functionName)

    const args =
      field.functionArgs
        ?.map((arg, index) => {
          const argDef = funcDef?.args[index]
          return formatFunctionArg(arg, argDef)
        })
        .join(', ') || ''

    let expression = `${field.functionName}(${args})`

    // Add arithmetic modifier if present
    if (field.arithmeticExpression) {
      expression += ` ${field.arithmeticExpression.operator} ${field.arithmeticExpression.operand}`
    }

    return expression
  }

  // Field + arithmetic only mode (no function)
  // Handle case where there's a source field with arithmetic but no wrapping function
  if (field.functionArgs && field.functionArgs.length > 0) {
    const firstArg = field.functionArgs[0]
    if (firstArg.type === 'field' && firstArg.fieldName && field.arithmeticExpression) {
      return `${firstArg.fieldName} ${field.arithmeticExpression.operator} ${field.arithmeticExpression.operand}`
    }
  }

  return 'Not configured'
}

export function TransformationFieldRow({
  field,
  availableFields,
  onUpdate,
  onRemove,
  errors = {},
  readOnly = false,
  index,
}: TransformationFieldRowProps) {
  // Expanded state
  const [isExpanded, setIsExpanded] = useState(false)

  // Ref for auto-focusing the output field name input
  const outputNameInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the output field name input when expanding
  useEffect(() => {
    if (isExpanded && outputNameInputRef.current) {
      // Small delay to ensure the animation has started
      const timeoutId = setTimeout(() => {
        outputNameInputRef.current?.focus()
        outputNameInputRef.current?.select()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isExpanded])

  // Local state for editing when expanded
  const [localField, setLocalField] = useState<Omit<TransformationField, 'id'>>({
    type: field.type,
    outputFieldName: field.outputFieldName,
    outputFieldType: field.outputFieldType,
    functionName: field.functionName,
    functionArgs: field.functionArgs,
    sourceField: field.sourceField,
    sourceFieldType: field.sourceFieldType,
    expressionMode: field.expressionMode,
    rawExpression: field.rawExpression,
    arithmeticExpression: field.arithmeticExpression,
  })

  // Check if the field can be saved (minimum requirements met)
  const canSaveField = useMemo(() => {
    // Output field name is always required
    if (!localField.outputFieldName || localField.outputFieldName.trim() === '') {
      return false
    }

    if (localField.type === 'passthrough') {
      // Passthrough needs a source field
      return !!localField.sourceField
    }

    if (localField.type === 'computed') {
      // Raw expression mode - just needs non-empty expression
      if (localField.expressionMode === 'raw') {
        return !!localField.rawExpression && localField.rawExpression.trim().length > 0
      }

      // Check if there's at least a source field selected (first arg)
      const firstArg = localField.functionArgs?.[0]
      if (firstArg?.type === 'field') {
        const hasFieldName = !!(firstArg as FunctionArgField).fieldName
        // Field + arithmetic is valid without function
        if (hasFieldName && localField.arithmeticExpression) {
          return true
        }
        // Field + function is valid
        if (hasFieldName && localField.functionName) {
          return true
        }
      }

      // No valid configuration
      return false
    }

    return false
  }, [localField])

  // Get function definition if computed field
  const functionDef =
    localField.type === 'computed' && localField.functionName ? getFunctionByName(localField.functionName) : null

  // Toggle expanded state
  const handleToggleExpand = useCallback(() => {
    if (!isExpanded) {
      // Reset local state when expanding
      setLocalField({
        type: field.type,
        outputFieldName: field.outputFieldName,
        outputFieldType: field.outputFieldType,
        functionName: field.functionName,
        functionArgs: field.functionArgs,
        sourceField: field.sourceField,
        sourceFieldType: field.sourceFieldType,
        expressionMode: field.expressionMode,
        rawExpression: field.rawExpression,
        arithmeticExpression: field.arithmeticExpression,
      })
    }
    setIsExpanded(!isExpanded)
  }, [isExpanded, field])

  // Update local field state
  const updateLocalField = useCallback((updates: Partial<Omit<TransformationField, 'id'>>) => {
    setLocalField((prev) => ({ ...prev, ...updates }))
  }, [])

  // Handle output field name change (inline in header)
  const handleOutputNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(field.id, { outputFieldName: e.target.value })
    },
    [field.id, onUpdate],
  )

  // Handle output field name change in expanded view
  const handleLocalOutputNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateLocalField({ outputFieldName: e.target.value })
    },
    [updateLocalField],
  )

  // Handle type change (passthrough vs computed)
  const handleTypeChange = useCallback(
    (value: string) => {
      const newType = value as 'passthrough' | 'computed'
      updateLocalField({
        type: newType,
        // Clear type-specific fields when switching
        functionName: newType === 'computed' ? '' : undefined,
        functionArgs: newType === 'computed' ? [] : undefined,
        sourceField: newType === 'passthrough' ? '' : undefined,
        sourceFieldType: newType === 'passthrough' ? '' : undefined,
        // Set default expression mode for computed fields
        expressionMode: newType === 'computed' ? 'nested' : undefined,
        rawExpression: undefined,
        arithmeticExpression: undefined,
      })
    },
    [updateLocalField],
  )

  // Handle source field change (for passthrough)
  const handleSourceFieldChange = useCallback(
    (value: string) => {
      const sourceField = availableFields.find((f) => f.name === value)
      updateLocalField({
        sourceField: value,
        sourceFieldType: sourceField?.type || 'string',
        outputFieldType: sourceField?.type || 'string',
        // Default output name to source field name if empty
        outputFieldName: localField.outputFieldName || value,
      })
    },
    [availableFields, localField.outputFieldName, updateLocalField],
  )

  // Handle function selection (for computed)
  const handleFunctionChange = useCallback(
    (functionName: string) => {
      const funcDef = getFunctionByName(functionName)
      const outputType = inferOutputType(functionName)

      // Initialize function arguments based on function definition
      const initialArgs: FunctionArg[] = funcDef
        ? funcDef.args.map((argDef) => {
          if (argDef.type === 'field') {
            return createFieldArg('', '')
          } else if (argDef.type === 'literal') {
            return createLiteralArg('', argDef.literalType || 'string')
          } else {
            return { type: 'array' as const, values: [], elementType: 'string' as const }
          }
        })
        : []

      updateLocalField({
        functionName,
        functionArgs: initialArgs,
        outputFieldType: outputType,
      })
    },
    [updateLocalField],
  )

  // Handle function argument change
  const handleArgChange = useCallback(
    (argIndex: number, value: string, argType: 'field' | 'literal' | 'array') => {
      const args = [...(localField.functionArgs || [])]

      if (argType === 'field') {
        const sourceField = availableFields.find((f) => f.name === value)
        args[argIndex] = createFieldArg(value, sourceField?.type || 'string')
      } else if (argType === 'literal') {
        const funcDef = getFunctionByName(localField.functionName || '')
        const argDef = funcDef?.args[argIndex]
        args[argIndex] = createLiteralArg(value, argDef?.literalType || 'string')
      }

      updateLocalField({ functionArgs: args })
    },
    [localField.functionName, localField.functionArgs, availableFields, updateLocalField],
  )

  // Handle expression mode change
  const handleExpressionModeChange = useCallback(
    (mode: ExpressionMode) => {
      updateLocalField({
        expressionMode: mode,
        // Reset mode-specific fields when switching
        ...(mode === 'raw' ? { functionName: '', functionArgs: [] } : {}),
        ...(mode !== 'raw' ? { rawExpression: '' } : {}),
      })
    },
    [updateLocalField],
  )

  // Handle function args change (for nested mode)
  const handleFunctionArgsChange = useCallback(
    (args: FunctionArg[]) => {
      updateLocalField({ functionArgs: args })
    },
    [updateLocalField],
  )

  // Handle raw expression change
  const handleRawExpressionChange = useCallback(
    (expression: string) => {
      updateLocalField({ rawExpression: expression })
    },
    [updateLocalField],
  )

  // Handle arithmetic expression change
  const handleArithmeticChange = useCallback(
    (arithmetic: TransformArithmeticExpression | undefined) => {
      updateLocalField({ arithmeticExpression: arithmetic })
    },
    [updateLocalField],
  )

  // Handle arithmetic enabled/disabled change
  const handleArithmeticEnabledChange = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        updateLocalField({ arithmeticExpression: undefined })
      } else if (!localField.arithmeticExpression) {
        // Initialize with default multiplication
        updateLocalField({ arithmeticExpression: { operator: '*', operand: 1 } })
      }
    },
    [updateLocalField, localField.arithmeticExpression],
  )

  // Handle output type override
  const handleOutputTypeChange = useCallback(
    (type: string) => {
      updateLocalField({ outputFieldType: type })
    },
    [updateLocalField],
  )

  // Available output types: same simplified list as Kafka type verification (single source of truth)
  const OUTPUT_TYPE_OPTIONS = useMemo(
    () =>
      JSON_DATA_TYPES.map((value) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
      })),
    [],
  )

  // Get the inferred type (normalized to simplified set) based on function or source field
  const getInferredType = (): string => {
    if (localField.type === 'passthrough') {
      return normalizeToJsonDataType(localField.sourceFieldType || 'string')
    }
    if (localField.type === 'computed' && localField.functionName) {
      return inferOutputType(localField.functionName)
    }
    return 'string'
  }

  // Get current argument value
  const getArgValue = (argIndex: number): string => {
    const arg = localField.functionArgs?.[argIndex]
    if (!arg) return ''
    if (arg.type === 'field') return arg.fieldName
    if (arg.type === 'literal') return String(arg.value)
    return ''
  }

  // Handle save
  const handleSave = useCallback(() => {
    onUpdate(field.id, localField)
    setIsExpanded(false)
  }, [field.id, localField, onUpdate])

  // Handle cancel
  const handleCancel = useCallback(() => {
    setIsExpanded(false)
  }, [])

  // Handle remove
  const handleRemove = useCallback(() => {
    onRemove(field.id)
  }, [field.id, onRemove])

  // Get source indicator text for the header
  const getSourceIndicator = (): string => {
    if (field.type === 'computed') {
      return 'Computed'
    }
    let indicator = field.sourceField || 'Not set'
    if (field.arithmeticExpression) {
      indicator += ` ${field.arithmeticExpression.operator} ${field.arithmeticExpression.operand}`
    }
    return indicator
  }

  // Check if computed field has a function configured
  const isComputedField = field.type === 'computed'
  const functionExpression = isComputedField ? formatFunctionExpression(field) : ''

  // Format passthrough expression with arithmetic if present
  const passthroughExpression =
    field.type === 'passthrough' && field.sourceField
      ? field.arithmeticExpression
        ? `${field.sourceField} ${field.arithmeticExpression.operator} ${field.arithmeticExpression.operand}`
        : field.sourceField
      : ''
  const hasPassthroughArithmetic = field.type === 'passthrough' && !!field.arithmeticExpression && !!field.sourceField

  return (
    <div
      className={cn(
        'card-outline rounded-[var(--radius-large)] overflow-hidden transition-all duration-200',
        errors && Object.keys(errors).length > 0 && 'border-[var(--color-border-critical)]',
        isExpanded && 'ring-1 ring-[var(--color-border-accent)]',
      )}
    >
      {/* Compact Header Row */}
      <div className="flex items-center gap-3 p-3">
        {/* Field Index Badge - fixed width */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--surface-bg-sunken)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)]">
          {index + 1}
        </div>

        {/* Output Field Name Input - 40% width */}
        <div className="w-[40%] flex-shrink-0 min-w-0">
          <Input
            value={field.outputFieldName}
            onChange={handleOutputNameChange}
            placeholder="Field name"
            disabled={readOnly || isExpanded}
            className={cn(
              'input-regular input-border-regular h-8 text-sm w-full truncate',
              errors?.outputFieldName && 'border-[var(--color-border-critical)]',
            )}
          />
        </div>

        {/* Output Type Badge - 15% width (normalized to simplified type set) */}
        <div className="w-[15%] flex-shrink-0 min-w-0 px-6 py-1 rounded-[var(--radius-small)] bg-[var(--surface-bg-sunken)] text-xs text-[var(--text-secondary)] font-medium truncate text-start">
          {field.outputFieldType ? normalizeToJsonDataType(field.outputFieldType) : ''}
        </div>

        {/* Source Indicator - 20% width */}
        <div
          className={cn(
            'w-[20%] flex-shrink-0 min-w-0 px-6 py-1 rounded-[var(--radius-small)] text-xs font-medium truncate text-start',
            field.type === 'computed'
              ? 'bg-[var(--color-bg-accent-muted)] text-[var(--text-accent)]'
              : 'bg-[var(--surface-bg-sunken)] text-[var(--text-secondary)]',
          )}
          title={getSourceIndicator()}
        >
          {getSourceIndicator()}
        </div>

        {/* Action Buttons - fixed width */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          {/* Edit/Collapse Button */}
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleExpand}
              className={cn(
                'h-8 w-8 transition-colors',
                isExpanded
                  ? 'text-[var(--text-accent)] hover:text-[var(--text-accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <PencilIcon className="h-4 w-4" />}
            </Button>
          )}

          {/* Delete Button */}
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="h-8 w-8 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Second Row - Function Expression (for computed fields only, when collapsed) */}
      {isComputedField && !isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[var(--surface-border-subtle)]">
          <div className="flex items-center gap-2 pt-3">
            <span className="text-xs text-[var(--text-disabled)] font-medium pl-2">Transformation Expression:</span>
            <code
              className={cn(
                'text-xs font-mono px-2 py-1 rounded-[var(--radius-small)]',
                functionExpression === 'Not configured'
                  ? 'text-[var(--text-disabled)] bg-[var(--surface-bg-sunken)]'
                  : 'text-[var(--text-accent)] bg-[var(--color-bg-accent-muted)]',
              )}
            >
              {functionExpression}
            </code>
          </div>
        </div>
      )}

      {/* Second Row - Passthrough Expression with Arithmetic (for passthrough fields with arithmetic, when collapsed) */}
      {hasPassthroughArithmetic && !isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[var(--surface-border-subtle)]">
          <div className="flex items-center gap-2 pt-3">
            <span className="text-xs text-[var(--text-disabled)] font-medium pl-2">Transformation Expression:</span>
            <code className="text-xs font-mono px-2 py-1 rounded-[var(--radius-small)] text-[var(--text-accent)] bg-[var(--color-bg-accent-muted)]">
              {passthroughExpression}
            </code>
          </div>
        </div>
      )}

      {/* Expanded Section */}
      {isExpanded && (
        <div className="border-t border-[var(--surface-border)] p-4 space-y-4 bg-[var(--surface-bg-sunken)] animate-[fadeIn_0.2s_ease-in-out]">
          <div className="flex items-start gap-4">
            {/* Output Field Name */}
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-[var(--text-secondary)]">
                Output Field Name <span className="text-[var(--color-foreground-critical)]">*</span>
              </Label>
              <Input
                ref={outputNameInputRef}
                value={localField.outputFieldName}
                onChange={handleLocalOutputNameChange}
                placeholder="Enter output field name"
                disabled={readOnly}
                className={cn(
                  'input-regular input-border-regular',
                  errors?.outputFieldName && 'border-[var(--color-border-critical)]',
                )}
              />
              {errors?.outputFieldName && (
                <p className="text-xs text-[var(--color-foreground-critical)]">{errors.outputFieldName}</p>
              )}
            </div>

            {/* Output Type Override (for computed fields) */}
            {localField.type === 'computed' && (
              <div className="space-y-1.5 w-48">
                <Label className="text-xs text-[var(--text-secondary)]">
                  Output Type
                  <span className="ml-1 text-[var(--text-disabled)]">(inferred: {getInferredType()})</span>
                </Label>
                <Select
                  value={normalizeToJsonDataType(localField.outputFieldType || getInferredType())}
                  onValueChange={handleOutputTypeChange}
                  disabled={readOnly}
                >
                  <SelectTrigger className="input-regular input-border-regular w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="select-content-custom">
                    {OUTPUT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="select-item-custom">
                        {opt.label}
                        {opt.value === getInferredType() && (
                          <span className="ml-2 text-xs text-[var(--text-secondary)]">(inferred)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Type and Expression Mode Row */}
          <div className="flex items-center gap-3">
            {/* Type Toggle */}
            <TypeToggle
              field={{ ...field, ...localField } as TransformationField}
              handleTypeChange={handleTypeChange}
              readOnly={readOnly}
            />

            {/* Expression Mode Toggle (for computed fields) */}
            {localField.type === 'computed' && (
              <div className="flex-1">
                <ExpressionModeToggle
                  mode={localField.expressionMode || 'nested'}
                  onChange={handleExpressionModeChange}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>

          {/* Source Field or Function Configuration */}
          <div className="space-y-2">
            {localField.type === 'passthrough' ? (
              <>
                <SourceFieldSelect
                  field={{ ...field, ...localField } as TransformationField}
                  handleSourceFieldChange={handleSourceFieldChange}
                  readOnly={readOnly}
                  errors={errors}
                  availableFields={availableFields}
                  className="w-full"
                />
                <ArithmeticModifier
                  enabled={!!localField.arithmeticExpression}
                  expression={localField.arithmeticExpression}
                  onEnabledChange={handleArithmeticEnabledChange}
                  onExpressionChange={handleArithmeticChange}
                  disabled={readOnly}
                  error={errors?.arithmeticExpression}
                />
              </>
            ) : (
              <TransformFunctionSelect
                field={{ ...field, ...localField } as TransformationField}
                handleFunctionChange={handleFunctionChange}
                readOnly={readOnly}
                errors={errors}
                availableFields={availableFields}
                functionDef={
                  functionDef || {
                    name: '',
                    category: 'utility',
                    description: '',
                    args: [],
                    returnType: '',
                    example: { input: '', output: '' },
                  }
                }
                getArgValue={getArgValue}
                handleArgChange={handleArgChange}
                onExpressionModeChange={handleExpressionModeChange}
                onFunctionArgsChange={handleFunctionArgsChange}
                onRawExpressionChange={handleRawExpressionChange}
                onArithmeticChange={handleArithmeticChange}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {/* Validation hint when save is disabled */}
            {!canSaveField && !readOnly && (
              <span className="text-xs text-[var(--text-disabled)] mr-2">
                {!localField.outputFieldName?.trim()
                  ? 'Enter an output field name'
                  : localField.type === 'passthrough'
                    ? 'Select a source field'
                    : localField.expressionMode === 'raw'
                      ? 'Enter a raw expression'
                      : 'Select an input field and function or arithmetic'}
              </span>
            )}
            <Button variant="outline" size="sm" className="btn-tertiary" onClick={handleCancel}>
              <XMarkIcon className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" className="btn-primary" onClick={handleSave} disabled={readOnly || !canSaveField}>
              <CheckIcon className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Error message display (when collapsed) */}
      {!isExpanded && errors?.outputFieldName && (
        <div className="px-3 pb-2">
          <p className="text-xs text-[var(--color-foreground-critical)]">{errors.outputFieldName}</p>
        </div>
      )}
    </div>
  )
}

export default TransformationFieldRow
