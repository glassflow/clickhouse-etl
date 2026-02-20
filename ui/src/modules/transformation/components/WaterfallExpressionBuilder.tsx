'use client'

import React, { useCallback, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { FieldSelectCombobox } from './FieldSelectCombobox'
import {
  WaterfallSlot,
  WaterfallSlotType,
  FunctionArg,
  FunctionArgField,
  FunctionArgLiteral,
} from '@/src/store/transformation.store'
import { FunctionSelector } from './FunctionSelector'
import { getFunctionByName, TRANSFORMATION_FUNCTIONS } from '../functions'
import { formatArgForExpr } from '../utils'

interface WaterfallExpressionBuilderProps {
  slots: WaterfallSlot[]
  availableFields: Array<{ name: string; type: string }>
  onSlotsChange: (slots: WaterfallSlot[]) => void
  onExpressionChange?: (expression: string) => void
  onSwitchToRegularMode?: () => void // Callback to switch back to regular function chain
  disabled?: boolean
  error?: string
}

const MAX_SLOTS = 5
const MIN_SLOTS = 2

// Get functions that can be used in waterfall slots (exclude waterfall itself and complex functions)
const getWaterfallCompatibleFunctions = () => {
  return TRANSFORMATION_FUNCTIONS.filter(
    (fn) =>
      fn.name !== 'waterfall' &&
      // Exclude functions that return complex types
      !fn.returnType.startsWith('[]') &&
      fn.returnType !== 'object' &&
      fn.returnType !== 'time.Time',
  )
}

const createEmptySlot = (): WaterfallSlot => ({
  id: uuidv4(),
  slotType: 'field',
  fieldName: '',
  fieldType: '',
})

export function WaterfallExpressionBuilder({
  slots,
  availableFields,
  onSlotsChange,
  onExpressionChange,
  onSwitchToRegularMode,
  disabled = false,
  error,
}: WaterfallExpressionBuilderProps) {
  const compatibleFunctions = useMemo(() => getWaterfallCompatibleFunctions(), [])

  // Initialize with minimum slots if empty
  const effectiveSlots = useMemo(() => {
    if (slots.length === 0) {
      return [createEmptySlot(), createEmptySlot()]
    }
    return slots
  }, [slots])

  // Generate expression for a single slot
  const slotToExpression = useCallback((slot: WaterfallSlot): string => {
    switch (slot.slotType) {
      case 'field':
        return slot.fieldName || '?'
      case 'literal':
        if (slot.literalType === 'number') {
          return slot.literalValue || '0'
        }
        // String literal - escape quotes
        const escaped = (slot.literalValue || '').replace(/"/g, '\\"')
        return `"${escaped}"`
      case 'function':
        if (!slot.functionName) return '?'
        const funcDef = getFunctionByName(slot.functionName)
        if (!funcDef) return '?'
        const args = (slot.functionArgs || []).map(formatArgForExpr)
        return `${slot.functionName}(${args.join(', ')})`
      default:
        return '?'
    }
  }, [])

  // Generate the full waterfall expression
  const fullExpression = useMemo(() => {
    const slotExprs = effectiveSlots.map(slotToExpression)
    return `waterfall([${slotExprs.join(', ')}])`
  }, [effectiveSlots, slotToExpression])

  // Notify parent of expression changes
  React.useEffect(() => {
    if (onExpressionChange) {
      onExpressionChange(fullExpression)
    }
  }, [fullExpression, onExpressionChange])

  // Handle adding a new slot
  const handleAddSlot = useCallback(() => {
    if (effectiveSlots.length >= MAX_SLOTS) return
    const newSlots = [...effectiveSlots, createEmptySlot()]
    onSlotsChange(newSlots)
  }, [effectiveSlots, onSlotsChange])

  // Handle removing a slot
  const handleRemoveSlot = useCallback(
    (index: number) => {
      if (effectiveSlots.length <= MIN_SLOTS) return
      const newSlots = effectiveSlots.filter((_, i) => i !== index)
      onSlotsChange(newSlots)
    },
    [effectiveSlots, onSlotsChange],
  )

  // Handle slot type change
  const handleSlotTypeChange = useCallback(
    (index: number, slotType: WaterfallSlotType) => {
      const newSlots = [...effectiveSlots]
      newSlots[index] = {
        ...newSlots[index],
        slotType,
        // Reset type-specific fields
        fieldName: slotType === 'field' ? newSlots[index].fieldName : undefined,
        fieldType: slotType === 'field' ? newSlots[index].fieldType : undefined,
        functionName: slotType === 'function' ? '' : undefined,
        functionArgs: slotType === 'function' ? [] : undefined,
        literalValue: slotType === 'literal' ? '' : undefined,
        literalType: slotType === 'literal' ? 'string' : undefined,
      }
      onSlotsChange(newSlots)
    },
    [effectiveSlots, onSlotsChange],
  )

  // Handle field selection for a slot
  const handleFieldChange = useCallback(
    (index: number, fieldName: string) => {
      const field = availableFields.find((f) => f.name === fieldName)
      const newSlots = [...effectiveSlots]
      newSlots[index] = {
        ...newSlots[index],
        fieldName,
        fieldType: field?.type || 'string',
      }
      onSlotsChange(newSlots)
    },
    [effectiveSlots, availableFields, onSlotsChange],
  )

  // Handle function selection for a slot
  const handleFunctionChange = useCallback(
    (index: number, functionName: string) => {
      const funcDef = getFunctionByName(functionName)
      // Initialize arguments based on function definition
      const initialArgs: FunctionArg[] =
        funcDef?.args.map((argDef) => {
          if (argDef.type === 'field') {
            return { type: 'field', fieldName: '', fieldType: '' } as FunctionArgField
          }
          return {
            type: 'literal',
            value: argDef.defaultValue ?? '',
            literalType: argDef.literalType || 'string',
          } as FunctionArgLiteral
        }) || []

      const newSlots = [...effectiveSlots]
      newSlots[index] = {
        ...newSlots[index],
        functionName,
        functionArgs: initialArgs,
      }
      onSlotsChange(newSlots)
    },
    [effectiveSlots, onSlotsChange],
  )

  // Handle function argument change for a slot
  const handleFunctionArgChange = useCallback(
    (slotIndex: number, argIndex: number, value: string, argType: 'field' | 'literal') => {
      const newSlots = [...effectiveSlots]
      const slot = newSlots[slotIndex]
      const newArgs = [...(slot.functionArgs || [])]

      if (argType === 'field') {
        const field = availableFields.find((f) => f.name === value)
        newArgs[argIndex] = {
          type: 'field',
          fieldName: value,
          fieldType: field?.type || 'string',
        } as FunctionArgField
      } else {
        const funcDef = getFunctionByName(slot.functionName || '')
        const argDef = funcDef?.args[argIndex]
        newArgs[argIndex] = {
          type: 'literal',
          value,
          literalType: argDef?.literalType || 'string',
        } as FunctionArgLiteral
      }

      newSlots[slotIndex] = {
        ...slot,
        functionArgs: newArgs,
      }
      onSlotsChange(newSlots)
    },
    [effectiveSlots, availableFields, onSlotsChange],
  )

  // Handle literal value change
  const handleLiteralChange = useCallback(
    (index: number, value: string) => {
      const newSlots = [...effectiveSlots]
      newSlots[index] = {
        ...newSlots[index],
        literalValue: value,
      }
      onSlotsChange(newSlots)
    },
    [effectiveSlots, onSlotsChange],
  )

  // Handle literal type change
  const handleLiteralTypeChange = useCallback(
    (index: number, literalType: 'string' | 'number') => {
      const newSlots = [...effectiveSlots]
      newSlots[index] = {
        ...newSlots[index],
        literalType,
      }
      onSlotsChange(newSlots)
    },
    [effectiveSlots, onSlotsChange],
  )

  // Get function argument value
  const getFunctionArgValue = (slot: WaterfallSlot, argIndex: number): string => {
    const arg = slot.functionArgs?.[argIndex]
    if (!arg) return ''
    if (arg.type === 'field') return (arg as FunctionArgField).fieldName
    if (arg.type === 'literal') return String((arg as FunctionArgLiteral).value)
    return ''
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-[var(--text-primary)]">Waterfall Function</Label>
            <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-accent-muted)] text-[var(--text-accent)] rounded-full">
              waterfall()
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Returns the first non-empty value from the list of expressions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">
            {effectiveSlots.length}/{MAX_SLOTS} slots
          </span>
          {!disabled && onSwitchToRegularMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchToRegularMode}
              className="h-7 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Change Function
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-[var(--color-foreground-critical)]">{error}</p>}

      {/* Slots list */}
      <div className="space-y-3">
        {effectiveSlots.map((slot, index) => {
          const funcDef =
            slot.slotType === 'function' && slot.functionName ? getFunctionByName(slot.functionName) : null

          return (
            <div
              key={slot.id}
              className="card-outline rounded-[var(--radius-xl)] p-3 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
            >
              <div className="flex items-start gap-3">
                {/* Slot number indicator */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--surface-bg-sunken)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)]">
                  {index + 1}
                </div>

                <div className="flex-1 space-y-3">
                  {/* Slot type selector */}
                  <div className="flex gap-2">
                    <Select
                      value={slot.slotType}
                      onValueChange={(v) => handleSlotTypeChange(index, v as WaterfallSlotType)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="input-regular input-border-regular w-32 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="select-content-custom">
                        <SelectItem value="field" className="select-item-custom text-sm">
                          Field
                        </SelectItem>
                        <SelectItem value="function" className="select-item-custom text-sm">
                          Function
                        </SelectItem>
                        <SelectItem value="literal" className="select-item-custom text-sm">
                          Literal
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Slot-type specific inputs */}
                    {slot.slotType === 'field' && (
                      <FieldSelectCombobox
                        value={slot.fieldName || ''}
                        onValueChange={(v) => handleFieldChange(index, v)}
                        availableFields={availableFields}
                        placeholder="Select field"
                        disabled={disabled}
                        triggerClassName="flex-1 h-8 text-sm"
                      />
                    )}

                    {slot.slotType === 'literal' && (
                      <>
                        <Select
                          value={slot.literalType || 'string'}
                          onValueChange={(v) => handleLiteralTypeChange(index, v as 'string' | 'number')}
                          disabled={disabled}
                        >
                          <SelectTrigger className="input-regular input-border-regular w-24 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="select-content-custom">
                            <SelectItem value="string" className="select-item-custom text-sm">
                              String
                            </SelectItem>
                            <SelectItem value="number" className="select-item-custom text-sm">
                              Number
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={slot.literalValue || ''}
                          onChange={(e) => handleLiteralChange(index, e.target.value)}
                          placeholder={slot.literalType === 'number' ? 'Enter number' : 'Enter value'}
                          disabled={disabled}
                          className="input-regular input-border-regular flex-1 h-8 text-sm"
                          type={slot.literalType === 'number' ? 'number' : 'text'}
                        />
                      </>
                    )}

                    {slot.slotType === 'function' && (
                      <div className="flex-1">
                        <FunctionSelector
                          value={slot.functionName || ''}
                          onSelect={(name) => handleFunctionChange(index, name)}
                          disabled={disabled}
                          filterFunctions={(fns) =>
                            fns.filter(
                              (fn) =>
                                fn.name !== 'waterfall' &&
                                !fn.returnType.startsWith('[]') &&
                                fn.returnType !== 'object' &&
                                fn.returnType !== 'time.Time',
                            )
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Function arguments (if function is selected) */}
                  {slot.slotType === 'function' && funcDef && funcDef.args.length > 0 && (
                    <div className="ml-2 pl-3 border-l-2 border-[var(--surface-border)] space-y-2">
                      {funcDef.args.map((argDef, argIndex) => (
                        <div key={argIndex} className="flex items-center gap-2">
                          <Label className="text-xs text-[var(--text-secondary)] w-24 flex-shrink-0">
                            {argDef.name}
                            {argDef.required !== false && ' *'}
                          </Label>
                          {argDef.type === 'field' ? (
                            <FieldSelectCombobox
                              value={getFunctionArgValue(slot, argIndex)}
                              onValueChange={(v) => handleFunctionArgChange(index, argIndex, v, 'field')}
                              availableFields={availableFields}
                              placeholder="Select field"
                              disabled={disabled}
                              filterTypes={argDef.fieldTypes}
                              triggerClassName="flex-1 h-8 text-sm"
                            />
                          ) : (
                            <Input
                              value={getFunctionArgValue(slot, argIndex)}
                              onChange={(e) => handleFunctionArgChange(index, argIndex, e.target.value, 'literal')}
                              placeholder={argDef.description}
                              disabled={disabled}
                              className="input-regular input-border-regular flex-1 h-8 text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {!disabled && effectiveSlots.length > MIN_SLOTS && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSlot(index)}
                    className="h-6 w-6 flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add slot button */}
      {!disabled && effectiveSlots.length < MAX_SLOTS && (
        <Button variant="outline" size="sm" onClick={handleAddSlot} className="btn-tertiary text-xs">
          <PlusIcon className="h-3 w-3 mr-1" />
          Add Expression ({effectiveSlots.length}/{MAX_SLOTS})
        </Button>
      )}

      {/* Expression Preview */}
      <div className="space-y-1 pt-2 border-t border-[var(--surface-border)]">
        <Label className="text-xs text-[var(--text-secondary)] block">Expression Preview</Label>
        <code className="block text-xs font-mono p-2 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-md)] border border-[var(--surface-border)] break-all">
          {fullExpression}
        </code>
      </div>
    </div>
  )
}

export default WaterfallExpressionBuilder
