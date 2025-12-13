'use client'

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { PlusIcon, TrashIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import {
  FunctionArg,
  FunctionArgField,
  FunctionArgLiteral,
  FunctionArgNestedFunction,
} from '@/src/store/transformation.store'
import { FunctionSelector } from './FunctionSelector'
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
  disabled?: boolean
  error?: string
}

let idCounter = 0
const generateId = () => `chain-func-${++idCounter}`

/**
 * Extracts the function chain from the nested structure.
 * e.g., toDate(parseISO8601(field)) becomes:
 * [{ functionName: 'parseISO8601', additionalArgs: [] }, { functionName: 'toDate', additionalArgs: [] }]
 */
function extractFunctionChain(
  functionName: string,
  functionArgs: FunctionArg[],
): { chain: ChainedFunction[]; sourceArg: FunctionArg | null } {
  const chain: ChainedFunction[] = []

  if (!functionName) {
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
 */
function buildNestedStructure(
  chain: ChainedFunction[],
  sourceArg: FunctionArg,
): { functionName: string; functionArgs: FunctionArg[] } {
  // Filter to only functions with names
  const validChain = chain.filter((f) => f.functionName)

  if (validChain.length === 0) {
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
  disabled = false,
  error,
}: NestedFunctionComposerProps) {
  // Local state for the chain - allows for placeholder functions
  const [chain, setChain] = useState<ChainedFunction[]>([])
  const [sourceArg, setSourceArg] = useState<FunctionArg>({
    type: 'field',
    fieldName: '',
    fieldType: '',
  } as FunctionArgField)

  // Initialize from props on mount and when props change significantly
  useEffect(() => {
    const extracted = extractFunctionChain(functionName, functionArgs)
    if (extracted.chain.length > 0) {
      setChain(extracted.chain)
    }
    if (extracted.sourceArg) {
      setSourceArg(extracted.sourceArg)
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
    [chain, sourceArg, syncToParent],
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
    if (validChain.length === 0) return '(select a function)'

    // Build expression string manually for preview
    let expr =
      sourceArg.type === 'field' ? (sourceArg as FunctionArgField).fieldName || '?' : formatArgForExpr(sourceArg)

    for (const func of validChain) {
      const additionalArgsStr = func.additionalArgs.map(formatArgForExpr).join(', ')
      expr = `${func.functionName}(${expr}${additionalArgsStr ? ', ' + additionalArgsStr : ''})`
    }

    return expr
  }, [chain, sourceArg])

  const maxChainLength = 5

  return (
    <div className="space-y-4">
      {/* Source field selection */}
      <div className="space-y-1">
        <Label className="text-xs text-[var(--text-secondary)] block">Source Field</Label>
        <Select
          value={sourceArg.type === 'field' ? (sourceArg as FunctionArgField).fieldName : ''}
          onValueChange={handleSourceChange}
          disabled={disabled}
        >
          <SelectTrigger className="input-regular input-border-regular">
            <SelectValue placeholder="Select source field" />
          </SelectTrigger>
          <SelectContent className="select-content-custom">
            {availableFields.map((f) => (
              <SelectItem key={f.name} value={f.name} className="select-item-custom">
                <span>{f.name}</span>
                <span className="ml-2 text-[var(--text-secondary)]">({f.type})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Function chain */}
      <div className="space-y-2">
        <Label className="text-xs text-[var(--text-secondary)] block">
          Function Chain {chain.length > 0 && `(${chain.length} function${chain.length > 1 ? 's' : ''})`}
        </Label>

        {chain.length === 0 ? (
          <div className="text-xs text-[var(--text-secondary)] italic p-2 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-medium)]">
            No functions added yet. Click "Add Function" to start building the chain.
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
                                  <Select
                                    value={
                                      func.additionalArgs[argIndex]?.type === 'field'
                                        ? (func.additionalArgs[argIndex] as FunctionArgField).fieldName
                                        : ''
                                    }
                                    onValueChange={(v) => handleAdditionalArgChange(index, argIndex, v, 'field')}
                                    disabled={disabled}
                                  >
                                    <SelectTrigger className="input-regular input-border-regular h-8 text-sm">
                                      <SelectValue placeholder="Select field" />
                                    </SelectTrigger>
                                    <SelectContent className="select-content-custom">
                                      {availableFields.map((f) => (
                                        <SelectItem key={f.name} value={f.name} className="select-item-custom text-sm">
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

      {/* Preview */}
      {chain.some((f) => f.functionName) && (
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
