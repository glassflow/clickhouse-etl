'use client'

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { PlusIcon, TrashIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import { FieldSelectCombobox } from './FieldSelectCombobox'
import {
  FunctionArg,
  FunctionArgField,
  FunctionArgLiteral,
  FunctionArgNestedFunction,
  FunctionArgWaterfallArray,
  FunctionArgConcatArray,
  WaterfallSlot,
  ConcatSlot,
  PostProcessFunction,
} from '@/src/store/transformation.store'
import { FunctionSelector } from './FunctionSelector'
import { WaterfallExpressionBuilder } from './WaterfallExpressionBuilder'
import { ConcatExpressionBuilder } from './ConcatExpressionBuilder'
import { getFunctionByName } from '../functions'
import { formatArgForExpr } from '../utils'

/**
 * Represents a single function in the chain.
 * The first function in the chain takes the source field as its first argument.
 * Subsequent functions take the result of the previous function as their first argument.
 */
interface ChainedFunction {
  id: string // Unique ID for React keys
  functionName: string
  // Additional arguments (beyond the piped first argument)
  additionalArgs: FunctionArg[]
}

interface NestedFunctionComposerProps {
  functionName: string
  functionArgs: FunctionArg[]
  availableFields: Array<{ name: string; type: string }>
  onFunctionChange: (functionName: string) => void
  onArgsChange: (args: FunctionArg[]) => void
  onExpressionChange?: (expression: string) => void // Callback to pass preview expression to parent
  disabled?: boolean
  error?: string
  hidePreview?: boolean // Option to hide the internal preview (when parent handles it)
}

let idCounter = 0
const generateId = () => `chain-func-${++idCounter}`

/**
 * Extracts the function chain from the nested structure.
 * e.g., toDate(parseISO8601(field)) becomes:
 * [{ functionName: 'parseISO8601', additionalArgs: [] }, { functionName: 'toDate', additionalArgs: [] }]
 * Also handles "field-only" mode (no function, just source field for arithmetic operations).
 */
function extractFunctionChain(
  functionName: string,
  functionArgs: FunctionArg[],
): { chain: ChainedFunction[]; sourceArg: FunctionArg | null } {
  const chain: ChainedFunction[] = []

  if (!functionName) {
    // Handle "field-only" mode - no function but has a source field
    // This supports field + arithmetic without a wrapping function
    if (functionArgs && functionArgs.length > 0 && functionArgs[0].type === 'field') {
      return { chain: [], sourceArg: functionArgs[0] }
    }
    return { chain: [], sourceArg: null }
  }

  // Walk through nested structure to build the chain (inside-out)
  let currentFunctionName = functionName
  let currentArgs = functionArgs

  while (currentFunctionName) {
    const firstArg = currentArgs[0]
    const additionalArgs = currentArgs.slice(1)

    // Check if first argument is a nested function (means we continue the chain)
    if (firstArg && firstArg.type === 'nested_function') {
      // Add current function to beginning of chain (we're building outside-in, but want inside-out order)
      chain.unshift({
        id: generateId(),
        functionName: currentFunctionName,
        additionalArgs,
      })
      // Continue with the nested function
      currentFunctionName = firstArg.functionName
      currentArgs = firstArg.functionArgs
    } else {
      // This is the innermost function
      chain.unshift({
        id: generateId(),
        functionName: currentFunctionName,
        additionalArgs,
      })
      // Return the source argument (field or literal that starts the chain)
      return { chain, sourceArg: firstArg || null }
    }
  }

  return { chain, sourceArg: null }
}

/**
 * Builds the nested function structure from a chain.
 * Only includes functions with valid names.
 * If no functions are in the chain but sourceArg has a field, returns just the source field
 * (to support field + arithmetic without function).
 */
function buildNestedStructure(
  chain: ChainedFunction[],
  sourceArg: FunctionArg,
): { functionName: string; functionArgs: FunctionArg[] } {
  // Filter to only functions with names
  const validChain = chain.filter((f) => f.functionName)

  if (validChain.length === 0) {
    // No functions, but if we have a valid source field, pass it through
    // This enables "field + arithmetic" mode without a wrapping function
    if (sourceArg.type === 'field' && (sourceArg as FunctionArgField).fieldName) {
      return { functionName: '', functionArgs: [sourceArg] }
    }
    return { functionName: '', functionArgs: [] }
  }

  if (validChain.length === 1) {
    // Single function - no nesting needed
    const func = validChain[0]
    return {
      functionName: func.functionName,
      functionArgs: [sourceArg, ...func.additionalArgs],
    }
  }

  // Multiple functions - build nested structure
  // Start from innermost function
  let result: FunctionArgNestedFunction = {
    type: 'nested_function',
    functionName: validChain[0].functionName,
    functionArgs: [sourceArg, ...validChain[0].additionalArgs],
  }

  for (let i = 1; i < validChain.length; i++) {
    const func = validChain[i]
    result = {
      type: 'nested_function',
      functionName: func.functionName,
      functionArgs: [result, ...func.additionalArgs],
    }
  }

  // The outermost function becomes the main function
  return {
    functionName: result.functionName,
    functionArgs: result.functionArgs,
  }
}

export function NestedFunctionComposer({
  functionName,
  functionArgs,
  availableFields,
  onFunctionChange,
  onArgsChange,
  onExpressionChange,
  disabled = false,
  error,
  hidePreview = false,
}: NestedFunctionComposerProps) {
  // Check if we're in waterfall mode or concat mode
  const isWaterfallMode = functionName === 'waterfall'
  const isConcatMode = functionName === 'concat'

  // Local state for the chain - allows for placeholder functions
  const [chain, setChain] = useState<ChainedFunction[]>([])
  const [sourceArg, setSourceArg] = useState<FunctionArg>({
    type: 'field',
    fieldName: '',
    fieldType: '',
  } as FunctionArgField)

  // State for waterfall slots
  const [waterfallSlots, setWaterfallSlots] = useState<WaterfallSlot[]>([])

  // State for concat slots
  const [concatSlots, setConcatSlots] = useState<ConcatSlot[]>([])

  // State for concat post-process chain
  const [concatPostProcessChain, setConcatPostProcessChain] = useState<PostProcessFunction[]>([])

  // Initialize from props on mount and when props change significantly
  useEffect(() => {
    if (isWaterfallMode) {
      // Extract waterfall slots from functionArgs
      const waterfallArg = functionArgs?.[0]
      if (waterfallArg && waterfallArg.type === 'waterfall_array') {
        setWaterfallSlots((waterfallArg as FunctionArgWaterfallArray).slots)
      }
    } else if (isConcatMode) {
      // Extract concat slots and post-process chain from functionArgs
      const concatArg = functionArgs?.[0]
      if (concatArg && concatArg.type === 'concat_array') {
        const typedArg = concatArg as FunctionArgConcatArray
        setConcatSlots(typedArg.slots)
        setConcatPostProcessChain(typedArg.postProcessChain || [])
      }
    } else {
      const extracted = extractFunctionChain(functionName, functionArgs)
      if (extracted.chain.length > 0) {
        setChain(extracted.chain)
      }
      if (extracted.sourceArg) {
        setSourceArg(extracted.sourceArg)
      }
    }
  }, []) // Only on mount - we manage state locally after that

  // Sync back to parent when chain or sourceArg changes (only for valid functions)
  const syncToParent = useCallback(
    (newChain: ChainedFunction[], newSourceArg: FunctionArg) => {
      const { functionName: newFuncName, functionArgs: newFuncArgs } = buildNestedStructure(newChain, newSourceArg)
      onFunctionChange(newFuncName)
      onArgsChange(newFuncArgs)
    },
    [onFunctionChange, onArgsChange],
  )

  // Handle source field change
  const handleSourceChange = useCallback(
    (fieldName: string) => {
      const field = availableFields.find((f) => f.name === fieldName)
      const newSourceArg: FunctionArgField = {
        type: 'field',
        fieldName,
        fieldType: field?.type || 'string',
      }
      setSourceArg(newSourceArg)
      syncToParent(chain, newSourceArg)
    },
    [chain, availableFields, syncToParent],
  )

  // Handle adding a new function to the chain
  const handleAddFunction = useCallback(() => {
    const newFunc: ChainedFunction = {
      id: generateId(),
      functionName: '',
      additionalArgs: [],
    }
    const newChain = [...chain, newFunc]
    setChain(newChain)
    // Don't sync to parent yet - wait until function is selected
  }, [chain])

  // Handle removing a function from the chain
  const handleRemoveFunction = useCallback(
    (index: number) => {
      const newChain = chain.filter((_, i) => i !== index)
      setChain(newChain)
      syncToParent(newChain, sourceArg)
    },
    [chain, sourceArg, syncToParent],
  )

  // Handle changing a function in the chain
  const handleFunctionChange = useCallback(
    (index: number, newFunctionName: string) => {
      // Special case: if waterfall is selected, switch to waterfall mode
      if (newFunctionName === 'waterfall') {
        // Initialize with empty waterfall slots and notify parent
        onFunctionChange('waterfall')
        const initialSlots: WaterfallSlot[] = [
          { id: `slot-${Date.now()}-1`, slotType: 'field', fieldName: '', fieldType: '' },
          { id: `slot-${Date.now()}-2`, slotType: 'field', fieldName: '', fieldType: '' },
        ]
        setWaterfallSlots(initialSlots)
        const waterfallArg: FunctionArgWaterfallArray = {
          type: 'waterfall_array',
          slots: initialSlots,
        }
        onArgsChange([waterfallArg])
        return
      }

      // Special case: if concat is selected, switch to concat mode
      if (newFunctionName === 'concat') {
        // Initialize with empty concat slots and notify parent
        onFunctionChange('concat')
        const initialSlots: ConcatSlot[] = [
          { id: `slot-${Date.now()}-1`, slotType: 'field', fieldName: '', fieldType: '' },
          { id: `slot-${Date.now()}-2`, slotType: 'field', fieldName: '', fieldType: '' },
        ]
        setConcatSlots(initialSlots)
        const concatArg: FunctionArgConcatArray = {
          type: 'concat_array',
          slots: initialSlots,
        }
        onArgsChange([concatArg])
        return
      }

      const funcDef = getFunctionByName(newFunctionName)
      // Initialize additional args based on function definition (skip first arg which is piped)
      const additionalArgDefs = funcDef?.args.slice(1) || []
      const additionalArgs: FunctionArg[] = additionalArgDefs.map((argDef) => {
        if (argDef.type === 'field') {
          return { type: 'field', fieldName: '', fieldType: '' } as FunctionArgField
        } else if (argDef.type === 'array') {
          return { type: 'array', values: [], elementType: 'string' } as any
        }
        return { type: 'literal', value: '', literalType: argDef.literalType || 'string' } as FunctionArgLiteral
      })

      const newChain = [...chain]
      newChain[index] = { ...newChain[index], functionName: newFunctionName, additionalArgs }
      setChain(newChain)
      syncToParent(newChain, sourceArg)
    },
    [chain, sourceArg, syncToParent, onFunctionChange, onArgsChange],
  )

  // Handle changing additional args for a function
  const handleAdditionalArgChange = useCallback(
    (funcIndex: number, argIndex: number, value: string, argType: 'field' | 'literal') => {
      const newChain = [...chain]
      const newAdditionalArgs = [...newChain[funcIndex].additionalArgs]

      if (argType === 'field') {
        const field = availableFields.find((f) => f.name === value)
        newAdditionalArgs[argIndex] = {
          type: 'field',
          fieldName: value,
          fieldType: field?.type || 'string',
        } as FunctionArgField
      } else {
        const funcDef = getFunctionByName(newChain[funcIndex].functionName)
        const argDef = funcDef?.args[argIndex + 1] // +1 because first arg is piped
        newAdditionalArgs[argIndex] = {
          type: 'literal',
          value,
          literalType: argDef?.literalType || 'string',
        } as FunctionArgLiteral
      }

      newChain[funcIndex] = { ...newChain[funcIndex], additionalArgs: newAdditionalArgs }
      setChain(newChain)
      syncToParent(newChain, sourceArg)
    },
    [chain, sourceArg, availableFields, syncToParent],
  )

  // Generate preview expression
  const previewExpr = useMemo(() => {
    const validChain = chain.filter((f) => f.functionName)

    // Build expression string manually for preview
    let expr =
      sourceArg.type === 'field' ? (sourceArg as FunctionArgField).fieldName || '' : formatArgForExpr(sourceArg)

    // If no functions but we have a source field, return just the field name
    // (parent component will add arithmetic expression if present)
    if (validChain.length === 0) {
      return expr
    }

    for (const func of validChain) {
      const additionalArgsStr = func.additionalArgs.map(formatArgForExpr).join(', ')
      expr = `${func.functionName}(${expr}${additionalArgsStr ? ', ' + additionalArgsStr : ''})`
    }

    return expr
  }, [chain, sourceArg])

  // Notify parent of expression changes
  useEffect(() => {
    if (onExpressionChange && !isWaterfallMode) {
      onExpressionChange(previewExpr)
    }
  }, [previewExpr, onExpressionChange, isWaterfallMode])

  // Handle waterfall slots change
  const handleWaterfallSlotsChange = useCallback(
    (newSlots: WaterfallSlot[]) => {
      setWaterfallSlots(newSlots)
      // Sync to parent via functionArgs
      const waterfallArg: FunctionArgWaterfallArray = {
        type: 'waterfall_array',
        slots: newSlots,
      }
      onArgsChange([waterfallArg])
    },
    [onArgsChange],
  )

  // Handle waterfall expression change
  const handleWaterfallExpressionChange = useCallback(
    (expr: string) => {
      if (onExpressionChange) {
        onExpressionChange(expr)
      }
    },
    [onExpressionChange],
  )

  // Handle concat slots change
  const handleConcatSlotsChange = useCallback(
    (newSlots: ConcatSlot[]) => {
      setConcatSlots(newSlots)
      // Sync to parent via functionArgs, preserving post-process chain
      const concatArg: FunctionArgConcatArray = {
        type: 'concat_array',
        slots: newSlots,
        postProcessChain: concatPostProcessChain.length > 0 ? concatPostProcessChain : undefined,
      }
      onArgsChange([concatArg])
    },
    [onArgsChange, concatPostProcessChain],
  )

  // Handle concat post-process chain change
  const handleConcatPostProcessChainChange = useCallback(
    (newChain: PostProcessFunction[]) => {
      setConcatPostProcessChain(newChain)
      // Sync to parent via functionArgs
      const concatArg: FunctionArgConcatArray = {
        type: 'concat_array',
        slots: concatSlots,
        postProcessChain: newChain.length > 0 ? newChain : undefined,
      }
      onArgsChange([concatArg])
    },
    [onArgsChange, concatSlots],
  )

  // Handle concat expression change
  const handleConcatExpressionChange = useCallback(
    (expr: string) => {
      if (onExpressionChange) {
        onExpressionChange(expr)
      }
    },
    [onExpressionChange],
  )

  // Handle switching from waterfall/concat back to regular mode
  const handleSwitchToRegularMode = useCallback(() => {
    // Reset to empty state
    setChain([])
    setSourceArg({ type: 'field', fieldName: '', fieldType: '' } as FunctionArgField)
    setWaterfallSlots([])
    setConcatSlots([])
    setConcatPostProcessChain([])
    onFunctionChange('')
    onArgsChange([])
  }, [onFunctionChange, onArgsChange])

  const maxChainLength = 5

  // Render concat mode
  if (isConcatMode) {
    return (
      <ConcatExpressionBuilder
        slots={concatSlots}
        availableFields={availableFields}
        onSlotsChange={handleConcatSlotsChange}
        postProcessChain={concatPostProcessChain}
        onPostProcessChainChange={handleConcatPostProcessChainChange}
        onExpressionChange={handleConcatExpressionChange}
        onSwitchToRegularMode={handleSwitchToRegularMode}
        disabled={disabled}
        error={error}
      />
    )
  }

  // Render waterfall mode
  if (isWaterfallMode) {
    return (
      <WaterfallExpressionBuilder
        slots={waterfallSlots}
        availableFields={availableFields}
        onSlotsChange={handleWaterfallSlotsChange}
        onExpressionChange={handleWaterfallExpressionChange}
        onSwitchToRegularMode={handleSwitchToRegularMode}
        disabled={disabled}
        error={error}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Source field selection */}
      <div className="space-y-1 w-1/2">
        <Label className="text-xs text-[var(--text-secondary)] block">Source Field</Label>
        <FieldSelectCombobox
          value={sourceArg.type === 'field' ? (sourceArg as FunctionArgField).fieldName : ''}
          onValueChange={handleSourceChange}
          availableFields={availableFields}
          placeholder="Select source field"
          disabled={disabled}
          className="w-full"
        />
      </div>

      {/* Function chain */}
      <div className="space-y-2">
        <Label className="text-xs text-[var(--text-secondary)] block">
          Function Chain {chain.length > 0 && `(${chain.length} function${chain.length > 1 ? 's' : ''})`}
        </Label>

        {chain.length === 0 ? (
          <div className="text-xs text-[var(--text-secondary)] italic p-2 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-medium)]">
            No functions added yet. Click &quot;Add Function&quot; to start building the chain.
          </div>
        ) : (
          <div className="space-y-2">
            {chain.map((func, index) => {
              const funcDef = getFunctionByName(func.functionName)
              const additionalArgDefs = funcDef?.args.slice(1) || []

              return (
                <div key={func.id}>
                  {/* Arrow indicator showing data flow */}
                  {index > 0 && (
                    <div className="flex items-center justify-center py-1">
                      <ArrowDownIcon className="h-4 w-4 text-[var(--text-secondary)]" />
                      <span className="text-xs text-[var(--text-secondary)] ml-1">pipes into</span>
                    </div>
                  )}

                  <div className="card-outline rounded-[var(--radius-large)] p-3 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
                    <div className="flex items-start gap-2">
                      {/* Function number */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--surface-bg-sunken)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)]">
                        {index + 1}
                      </div>

                      <div className="flex-1 space-y-2">
                        {/* Function selector */}
                        <FunctionSelector
                          value={func.functionName}
                          onSelect={(name) => handleFunctionChange(index, name)}
                          disabled={disabled}
                          error={index === 0 ? error : undefined}
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
                                  <FieldSelectCombobox
                                    value={
                                      func.additionalArgs[argIndex]?.type === 'field'
                                        ? (func.additionalArgs[argIndex] as FunctionArgField).fieldName
                                        : ''
                                    }
                                    onValueChange={(v) => handleAdditionalArgChange(index, argIndex, v, 'field')}
                                    availableFields={availableFields}
                                    placeholder="Select field"
                                    disabled={disabled}
                                    filterTypes={argDef.fieldTypes}
                                    triggerClassName="h-8 text-sm"
                                  />
                                ) : (
                                  <Input
                                    value={
                                      func.additionalArgs[argIndex]?.type === 'literal'
                                        ? String((func.additionalArgs[argIndex] as FunctionArgLiteral).value)
                                        : ''
                                    }
                                    onChange={(e) =>
                                      handleAdditionalArgChange(index, argIndex, e.target.value, 'literal')
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
                          onClick={() => handleRemoveFunction(index)}
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
      </div>

      {/* Add function button */}
      {!disabled && chain.length < maxChainLength && (
        <Button variant="outline" size="sm" onClick={handleAddFunction} className="btn-tertiary text-xs">
          <PlusIcon className="h-3 w-3 mr-1" />
          {chain.length === 0 ? 'Add Function' : 'Add Outer Function (wraps result)'}
        </Button>
      )}

      {/* Preview - only show if not hidden by parent */}
      {!hidePreview && chain.some((f) => f.functionName) && previewExpr && (
        <div className="space-y-1">
          <Label className="text-xs text-[var(--text-secondary)] block">Expression Preview</Label>
          <code className="block text-xs font-mono p-2 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-medium)] border border-[var(--surface-border)] break-all">
            {previewExpr}
          </code>
        </div>
      )}
    </div>
  )
}

export default NestedFunctionComposer
