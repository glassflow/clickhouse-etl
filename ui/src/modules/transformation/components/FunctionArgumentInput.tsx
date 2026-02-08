'use client'

import React, { useCallback } from 'react'
import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Button } from '@/src/components/ui/button'
import { FieldSelectCombobox } from './FieldSelectCombobox'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  FunctionArg,
  FunctionArgField,
  FunctionArgLiteral,
  FunctionArgNestedFunction,
} from '@/src/store/transformation.store'
import { FunctionSelector } from './FunctionSelector'
import { getFunctionByName } from '../functions'
import { cn } from '@/src/utils/common.client'

type ArgumentType = 'field' | 'literal' | 'nested_function'

interface FunctionArgumentInputProps {
  argument: FunctionArg
  availableFields: Array<{ name: string; type: string }>
  onChange: (arg: FunctionArg) => void
  onRemove?: () => void
  disabled?: boolean
  label?: string
  depth?: number
  error?: string
}

export function FunctionArgumentInput({
  argument,
  availableFields,
  onChange,
  onRemove,
  disabled = false,
  label,
  depth = 0,
  error,
}: FunctionArgumentInputProps) {
  // Handle type change
  const handleTypeChange = useCallback(
    (newType: ArgumentType) => {
      if (newType === 'field') {
        onChange({
          type: 'field',
          fieldName: '',
          fieldType: '',
        } as FunctionArgField)
      } else if (newType === 'literal') {
        onChange({
          type: 'literal',
          value: '',
          literalType: 'string',
        } as FunctionArgLiteral)
      } else if (newType === 'nested_function') {
        onChange({
          type: 'nested_function',
          functionName: '',
          functionArgs: [],
        } as FunctionArgNestedFunction)
      }
    },
    [onChange],
  )

  // Handle field selection
  const handleFieldChange = useCallback(
    (fieldName: string) => {
      const field = availableFields.find((f) => f.name === fieldName)
      onChange({
        type: 'field',
        fieldName,
        fieldType: field?.type || 'string',
      } as FunctionArgField)
    },
    [availableFields, onChange],
  )

  // Handle literal value change
  const handleLiteralChange = useCallback(
    (value: string) => {
      const currentArg = argument as FunctionArgLiteral
      onChange({
        type: 'literal',
        value,
        literalType: currentArg.literalType || 'string',
      } as FunctionArgLiteral)
    },
    [argument, onChange],
  )

  // Handle nested function name change
  const handleNestedFunctionChange = useCallback(
    (functionName: string) => {
      const funcDef = getFunctionByName(functionName)
      // Initialize with empty args based on function definition
      const initialArgs: FunctionArg[] = funcDef
        ? funcDef.args.map((argDef) => {
            if (argDef.type === 'field') {
              return { type: 'field', fieldName: '', fieldType: '' } as FunctionArgField
            }
            return { type: 'literal', value: '', literalType: 'string' } as FunctionArgLiteral
          })
        : []

      onChange({
        type: 'nested_function',
        functionName,
        functionArgs: initialArgs,
      } as FunctionArgNestedFunction)
    },
    [onChange],
  )

  // Handle nested function argument change
  const handleNestedArgChange = useCallback(
    (index: number, newArg: FunctionArg) => {
      if (argument.type !== 'nested_function') return
      const newArgs = [...argument.functionArgs]
      newArgs[index] = newArg
      onChange({
        ...argument,
        functionArgs: newArgs,
      })
    },
    [argument, onChange],
  )

  // Render based on argument type
  const renderInput = () => {
    switch (argument.type) {
      case 'field':
        return (
          <FieldSelectCombobox
            value={argument.fieldName || ''}
            onValueChange={handleFieldChange}
            availableFields={availableFields}
            placeholder="Select field"
            disabled={disabled}
            error={Boolean(error)}
            className="flex-1"
          />
        )

      case 'literal':
        return (
          <Input
            value={String(argument.value)}
            onChange={(e) => handleLiteralChange(e.target.value)}
            placeholder="Enter value"
            disabled={disabled}
            className={cn(
              'input-regular input-border-regular flex-1',
              error && 'border-[var(--color-border-critical)]',
            )}
          />
        )

      case 'nested_function':
        const funcDef = getFunctionByName(argument.functionName)
        return (
          <div className="space-y-2 flex-1">
            <FunctionSelector
              value={argument.functionName || ''}
              onSelect={handleNestedFunctionChange}
              disabled={disabled}
              error={!argument.functionName ? error : undefined}
            />
            {/* Nested function arguments */}
            {argument.functionName && funcDef && argument.functionArgs.length > 0 && (
              <div className="ml-4 space-y-2 border-l-2 border-[var(--surface-border)] pl-3">
                {funcDef.args.map((argDef, index) => (
                  <FunctionArgumentInput
                    key={index}
                    argument={argument.functionArgs[index] || { type: 'field', fieldName: '', fieldType: '' }}
                    availableFields={availableFields}
                    onChange={(newArg) => handleNestedArgChange(index, newArg)}
                    disabled={disabled}
                    label={argDef.name}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-1">
      {label && <Label className="text-xs text-[var(--text-secondary)] block">{label}</Label>}
      <div className="flex items-start gap-2">
        {/* Type selector */}
        <Select value={argument.type} onValueChange={(v) => handleTypeChange(v as ArgumentType)} disabled={disabled}>
          <SelectTrigger className="w-[100px] input-regular input-border-regular text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="select-content-custom">
            <SelectItem value="field" className="select-item-custom text-xs">
              Field
            </SelectItem>
            <SelectItem value="literal" className="select-item-custom text-xs">
              Value
            </SelectItem>
            {depth < 3 && (
              <SelectItem value="nested_function" className="select-item-custom text-xs">
                Function
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Value input */}
        {renderInput()}

        {/* Remove button */}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={disabled}
            className="h-8 w-8 flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{error}</p>}
    </div>
  )
}

export default FunctionArgumentInput
