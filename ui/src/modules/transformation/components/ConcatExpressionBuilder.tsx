'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { PlusIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import {
  ConcatSlot,
  ConcatSlotType,
  PostProcessFunction,
  FunctionArg,
  FunctionArgField,
  FunctionArgLiteral,
} from '@/src/store/transformation.store'
import { FunctionSelector } from './FunctionSelector'
import { getFunctionByName, TransformationFunctionDef } from '../functions'
import { formatArgForExpr } from '../utils'

interface ConcatExpressionBuilderProps {
  slots: ConcatSlot[]
  availableFields: Array<{ name: string; type: string }>
  onSlotsChange: (slots: ConcatSlot[]) => void
  postProcessChain?: PostProcessFunction[]
  onPostProcessChainChange?: (chain: PostProcessFunction[]) => void
  onExpressionChange?: (expression: string) => void
  onSwitchToRegularMode?: () => void
  disabled?: boolean
  error?: string
}

const MAX_SLOTS = 10
const MIN_SLOTS = 1
const MAX_POST_PROCESS_FUNCTIONS = 5

const createEmptySlot = (): ConcatSlot => ({
  id: uuidv4(),
  slotType: 'field',
  fieldName: '',
  fieldType: '',
})

const createEmptyPostProcessFunction = (): PostProcessFunction => ({
  id: uuidv4(),
  functionName: '',
  additionalArgs: [],
})

// Filter out special functions that have their own builders
const filterPostProcessFunctions = (functions: TransformationFunctionDef[]): TransformationFunctionDef[] => {
  return functions.filter((fn) => fn.name !== 'concat' && fn.name !== 'waterfall')
}

export function ConcatExpressionBuilder({
  slots,
  availableFields,
  onSlotsChange,
  postProcessChain = [],
  onPostProcessChainChange,
  onExpressionChange,
  onSwitchToRegularMode,
  disabled = false,
  error,
}: ConcatExpressionBuilderProps) {
  // State for collapsible post-processing section
  const [isPostProcessExpanded, setIsPostProcessExpanded] = useState(postProcessChain.length > 0)

  // Initialize with minimum slots if empty
  const effectiveSlots = useMemo(() => {
    if (slots.length === 0) {
      return [createEmptySlot(), createEmptySlot()]
    }
    return slots
  }, [slots])

  // Generate expression for a single slot
  const slotToExpression = useCallback((slot: ConcatSlot): string => {
    switch (slot.slotType) {
      case 'field':
        return slot.fieldName || '?'
      case 'literal':
        // String literal - escape quotes
        const escaped = (slot.literalValue || '').replace(/"/g, '\\"')
        return `"${escaped}"`
      default:
        return '?'
    }
  }, [])

  // Generate the full concat expression including post-process chain
  const fullExpression = useMemo(() => {
    const slotExprs = effectiveSlots.map(slotToExpression)
    let expr = `concat(${slotExprs.join(', ')})`

    // Apply post-process chain
    if (postProcessChain && postProcessChain.length > 0) {
      for (const func of postProcessChain) {
        if (!func.functionName) continue
        const additionalArgsStr = func.additionalArgs.map(formatArgForExpr).join(', ')
        expr = `${func.functionName}(${expr}${additionalArgsStr ? ', ' + additionalArgsStr : ''})`
      }
    }

    return expr
  }, [effectiveSlots, slotToExpression, postProcessChain])

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
    (index: number, slotType: ConcatSlotType) => {
      const newSlots = [...effectiveSlots]
      newSlots[index] = {
        ...newSlots[index],
        slotType,
        // Reset type-specific fields
        fieldName: slotType === 'field' ? newSlots[index].fieldName : undefined,
        fieldType: slotType === 'field' ? newSlots[index].fieldType : undefined,
        literalValue: slotType === 'literal' ? '' : undefined,
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

  // Post-process chain handlers
  const handleAddPostProcessFunction = useCallback(() => {
    if (!onPostProcessChainChange) return
    if (postProcessChain.length >= MAX_POST_PROCESS_FUNCTIONS) return
    const newChain = [...postProcessChain, createEmptyPostProcessFunction()]
    onPostProcessChainChange(newChain)
    setIsPostProcessExpanded(true)
  }, [postProcessChain, onPostProcessChainChange])

  const handleRemovePostProcessFunction = useCallback(
    (index: number) => {
      if (!onPostProcessChainChange) return
      const newChain = postProcessChain.filter((_, i) => i !== index)
      onPostProcessChainChange(newChain)
    },
    [postProcessChain, onPostProcessChainChange],
  )

  const handlePostProcessFunctionChange = useCallback(
    (index: number, functionName: string) => {
      if (!onPostProcessChainChange) return
      const funcDef = getFunctionByName(functionName)
      // Initialize additional args based on function definition (skip first arg which is piped)
      const additionalArgDefs = funcDef?.args.slice(1) || []
      const additionalArgs: FunctionArg[] = additionalArgDefs.map((argDef) => {
        if (argDef.type === 'field') {
          return { type: 'field', fieldName: '', fieldType: '' } as FunctionArgField
        }
        return { type: 'literal', value: '', literalType: argDef.literalType || 'string' } as FunctionArgLiteral
      })

      const newChain = [...postProcessChain]
      newChain[index] = {
        ...newChain[index],
        functionName,
        additionalArgs,
      }
      onPostProcessChainChange(newChain)
    },
    [postProcessChain, onPostProcessChainChange],
  )

  const handlePostProcessArgChange = useCallback(
    (funcIndex: number, argIndex: number, value: string, argType: 'field' | 'literal') => {
      if (!onPostProcessChainChange) return
      const newChain = [...postProcessChain]
      const func = newChain[funcIndex]
      const newAdditionalArgs = [...func.additionalArgs]

      if (argType === 'field') {
        const field = availableFields.find((f) => f.name === value)
        newAdditionalArgs[argIndex] = {
          type: 'field',
          fieldName: value,
          fieldType: field?.type || 'string',
        } as FunctionArgField
      } else {
        const funcDef = getFunctionByName(func.functionName)
        const argDef = funcDef?.args[argIndex + 1] // +1 because first arg is piped
        newAdditionalArgs[argIndex] = {
          type: 'literal',
          value,
          literalType: argDef?.literalType || 'string',
        } as FunctionArgLiteral
      }

      newChain[funcIndex] = { ...func, additionalArgs: newAdditionalArgs }
      onPostProcessChainChange(newChain)
    },
    [postProcessChain, availableFields, onPostProcessChainChange],
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-[var(--text-primary)]">Concat Function</Label>
            <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-accent-muted)] text-[var(--text-accent)] rounded-full">
              concat()
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Concatenate multiple values together into a single string
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">
            {effectiveSlots.length}/{MAX_SLOTS} values
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
        {effectiveSlots.map((slot, index) => (
          <div
            key={slot.id}
            className="card-outline rounded-[var(--radius-large)] p-3 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
          >
            <div className="flex items-center gap-3">
              {/* Slot number indicator */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--surface-bg-sunken)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)]">
                {index + 1}
              </div>

              <div className="flex-1 flex gap-2">
                {/* Slot type selector */}
                <Select
                  value={slot.slotType}
                  onValueChange={(v) => handleSlotTypeChange(index, v as ConcatSlotType)}
                  disabled={disabled}
                >
                  <SelectTrigger className="input-regular input-border-regular w-28 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="select-content-custom">
                    <SelectItem value="field" className="select-item-custom text-sm">
                      Field
                    </SelectItem>
                    <SelectItem value="literal" className="select-item-custom text-sm">
                      Text
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Slot-type specific inputs */}
                {slot.slotType === 'field' && (
                  <Select
                    value={slot.fieldName || ''}
                    onValueChange={(v) => handleFieldChange(index, v)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="input-regular input-border-regular flex-1 h-8 text-sm">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent className="select-content-custom">
                      {availableFields.map((f) => (
                        <SelectItem key={f.name} value={f.name} className="select-item-custom text-sm">
                          <span>{f.name}</span>
                          <span className="ml-2 text-[var(--text-secondary)]">({f.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {slot.slotType === 'literal' && (
                  <Input
                    value={slot.literalValue || ''}
                    onChange={(e) => handleLiteralChange(index, e.target.value)}
                    placeholder='Enter text (e.g., " " for space)'
                    disabled={disabled}
                    className="input-regular input-border-regular flex-1 h-8 text-sm"
                  />
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
        ))}
      </div>

      {/* Add slot button */}
      {!disabled && effectiveSlots.length < MAX_SLOTS && (
        <Button variant="outline" size="sm" onClick={handleAddSlot} className="btn-tertiary text-xs">
          <PlusIcon className="h-3 w-3 mr-1" />
          Add Value ({effectiveSlots.length}/{MAX_SLOTS})
        </Button>
      )}

      {/* Post-Processing Section */}
      {onPostProcessChainChange && (
        <div className="pt-3 border-t border-[var(--surface-border)]">
          {/* Collapsible header */}
          <button
            type="button"
            onClick={() => setIsPostProcessExpanded(!isPostProcessExpanded)}
            className="flex items-center gap-2 w-full text-left group"
            disabled={disabled}
          >
            {isPostProcessExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-[var(--text-secondary)]" />
            )}
            <div className="flex-1">
              <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-accent)]">
                Post-Processing
              </span>
              {postProcessChain.length > 0 && (
                <span className="ml-2 text-xs px-1.5 py-0.5 bg-[var(--color-bg-accent-muted)] text-[var(--text-accent)] rounded">
                  {postProcessChain.length} function{postProcessChain.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span className="text-xs text-[var(--text-secondary)]">optional</span>
          </button>

          <p className="text-xs text-[var(--text-secondary)] mt-1 ml-6">
            Apply additional functions to transform the concatenated result
          </p>

          {/* Post-process chain content */}
          {isPostProcessExpanded && (
            <div className="mt-3 ml-6 space-y-3">
              {postProcessChain.length === 0 ? (
                <div className="text-xs text-[var(--text-secondary)] italic p-2 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-medium)]">
                  No post-processing functions added. Click &quot;Add Function&quot; to transform the concat result.
                </div>
              ) : (
                <div className="space-y-2">
                  {postProcessChain.map((func, index) => {
                    const funcDef = getFunctionByName(func.functionName)
                    const additionalArgDefs = funcDef?.args.slice(1) || []

                    return (
                      <div key={func.id}>
                        {/* Arrow indicator showing data flow */}
                        {index === 0 && (
                          <div className="flex items-center py-1 mb-2">
                            <ArrowDownIcon className="h-4 w-4 text-[var(--text-secondary)]" />
                            <span className="text-xs text-[var(--text-secondary)] ml-1">concat result pipes into</span>
                          </div>
                        )}
                        {index > 0 && (
                          <div className="flex items-center justify-center py-1">
                            <ArrowDownIcon className="h-4 w-4 text-[var(--text-secondary)]" />
                            <span className="text-xs text-[var(--text-secondary)] ml-1">pipes into</span>
                          </div>
                        )}

                        <div className="card-outline rounded-[var(--radius-large)] p-3 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
                          <div className="flex items-start gap-2">
                            {/* Function number */}
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-bg-accent-muted)] flex items-center justify-center text-xs font-medium text-[var(--text-accent)]">
                              {index + 1}
                            </div>

                            <div className="flex-1 space-y-2">
                              {/* Function selector */}
                              <FunctionSelector
                                value={func.functionName}
                                onSelect={(name) => handlePostProcessFunctionChange(index, name)}
                                disabled={disabled}
                                filterFunctions={filterPostProcessFunctions}
                                className="h-8 text-sm"
                              />

                              {/* Additional arguments (if any) */}
                              {additionalArgDefs.length > 0 && (
                                <div className="ml-2 border-l-2 border-[var(--surface-border)] pl-3 space-y-2">
                                  {additionalArgDefs.map((argDef, argIndex) => (
                                    <div key={argIndex} className="space-y-1">
                                      <Label className="text-xs text-[var(--text-secondary)]">
                                        {argDef.name}
                                        {argDef.required !== false && ' *'}
                                      </Label>
                                      {argDef.type === 'field' ? (
                                        <Select
                                          value={
                                            func.additionalArgs[argIndex]?.type === 'field'
                                              ? (func.additionalArgs[argIndex] as FunctionArgField).fieldName
                                              : ''
                                          }
                                          onValueChange={(v) =>
                                            handlePostProcessArgChange(index, argIndex, v, 'field')
                                          }
                                          disabled={disabled}
                                        >
                                          <SelectTrigger className="input-regular input-border-regular h-8 text-sm">
                                            <SelectValue placeholder="Select field" />
                                          </SelectTrigger>
                                          <SelectContent className="select-content-custom">
                                            {availableFields.map((f) => (
                                              <SelectItem
                                                key={f.name}
                                                value={f.name}
                                                className="select-item-custom text-sm"
                                              >
                                                {f.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input
                                          value={
                                            func.additionalArgs[argIndex]?.type === 'literal'
                                              ? String((func.additionalArgs[argIndex] as FunctionArgLiteral).value)
                                              : ''
                                          }
                                          onChange={(e) =>
                                            handlePostProcessArgChange(index, argIndex, e.target.value, 'literal')
                                          }
                                          placeholder={argDef.description}
                                          disabled={disabled}
                                          className="input-regular input-border-regular h-8 text-sm"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Remove button */}
                            {!disabled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemovePostProcessFunction(index)}
                                className="h-6 w-6 flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add function button */}
              {!disabled && postProcessChain.length < MAX_POST_PROCESS_FUNCTIONS && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddPostProcessFunction}
                  className="btn-tertiary text-xs"
                >
                  <PlusIcon className="h-3 w-3 mr-1" />
                  {postProcessChain.length === 0 ? 'Add Function' : 'Add Outer Function (wraps result)'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expression Preview */}
      <div className="space-y-1 pt-2 border-t border-[var(--surface-border)]">
        <Label className="text-xs text-[var(--text-secondary)] block">Expression Preview</Label>
        <code className="block text-xs font-mono p-2 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-medium)] border border-[var(--surface-border)] break-all">
          {fullExpression}
        </code>
      </div>
    </div>
  )
}

export default ConcatExpressionBuilder
