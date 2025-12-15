'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { TrashIcon } from '@heroicons/react/24/outline'
import {
  TransformationField,
  FunctionArg,
  ExpressionMode,
  TransformArithmeticExpression,
} from '@/src/store/transformation.store'
import { FunctionSelector } from './FunctionSelector'
import { getFunctionByName, TransformationFunctionDef } from '../functions'
import { inferOutputType, createFieldArg, createLiteralArg } from '../utils'
import { FieldValidation } from '../utils'
import { cn } from '@/src/utils/common.client'
import OutputField from './OutputField'
import TypeToggle from './TypeToggle'
import SourceFieldSelect from './SourceFieldSelect'
import TransformFunctionSelect from './TransformFunctionSelect'
import { ExpressionModeToggle } from './ExpressionModeToggle'

interface TransformationFieldRowProps {
  field: TransformationField
  availableFields: Array<{ name: string; type: string }>
  onUpdate: (fieldId: string, updates: Partial<Omit<TransformationField, 'id'>>) => void
  onRemove: (fieldId: string) => void
  errors?: FieldValidation['errors']
  readOnly?: boolean
  index: number
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
  // Get function definition if computed field
  const functionDef = field.type === 'computed' && field.functionName ? getFunctionByName(field.functionName) : null

  const [fieldTypeMode, setFieldTypeMode] = useState<'computed' | 'passthrough' | null>(null)

  // Handle output field name change
  const handleOutputNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(field.id, { outputFieldName: e.target.value })
    },
    [field.id, onUpdate],
  )

  // Handle type change (passthrough vs computed)
  const handleTypeChange = useCallback(
    (value: string) => {
      const newType = value as 'passthrough' | 'computed'
      setFieldTypeMode(newType)
      onUpdate(field.id, {
        type: newType,
        // Clear type-specific fields when switching
        functionName: newType === 'computed' ? '' : undefined,
        functionArgs: newType === 'computed' ? [] : undefined,
        sourceField: newType === 'passthrough' ? '' : undefined,
        sourceFieldType: newType === 'passthrough' ? '' : undefined,
        // Set default expression mode for computed fields (using nested mode which handles both simple and complex cases)
        expressionMode: newType === 'computed' ? 'nested' : undefined,
        rawExpression: undefined,
        arithmeticExpression: undefined,
      })
    },
    [field.id, onUpdate],
  )

  // Handle source field change (for passthrough)
  const handleSourceFieldChange = useCallback(
    (value: string) => {
      const sourceField = availableFields.find((f) => f.name === value)
      onUpdate(field.id, {
        sourceField: value,
        sourceFieldType: sourceField?.type || 'string',
        outputFieldType: sourceField?.type || 'string',
        // Default output name to source field name if empty
        outputFieldName: field.outputFieldName || value,
      })
    },
    [field.id, field.outputFieldName, availableFields, onUpdate],
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

      onUpdate(field.id, {
        functionName,
        functionArgs: initialArgs,
        outputFieldType: outputType,
      })
    },
    [field.id, onUpdate],
  )

  // Handle function argument change
  const handleArgChange = useCallback(
    (argIndex: number, value: string, argType: 'field' | 'literal' | 'array') => {
      const args = [...(field.functionArgs || [])]

      if (argType === 'field') {
        const sourceField = availableFields.find((f) => f.name === value)
        args[argIndex] = createFieldArg(value, sourceField?.type || 'string')
      } else if (argType === 'literal') {
        const funcDef = getFunctionByName(field.functionName || '')
        const argDef = funcDef?.args[argIndex]
        args[argIndex] = createLiteralArg(value, argDef?.literalType || 'string')
      }

      onUpdate(field.id, { functionArgs: args })
    },
    [field.id, field.functionName, field.functionArgs, availableFields, onUpdate],
  )

  // Handle expression mode change
  const handleExpressionModeChange = useCallback(
    (mode: ExpressionMode) => {
      onUpdate(field.id, {
        expressionMode: mode,
        // Reset mode-specific fields when switching
        ...(mode === 'raw' ? { functionName: '', functionArgs: [] } : {}),
        ...(mode !== 'raw' ? { rawExpression: '' } : {}),
      })
    },
    [field.id, onUpdate],
  )

  // Handle function args change (for nested mode)
  const handleFunctionArgsChange = useCallback(
    (args: FunctionArg[]) => {
      onUpdate(field.id, { functionArgs: args })
    },
    [field.id, onUpdate],
  )

  // Handle raw expression change
  const handleRawExpressionChange = useCallback(
    (expression: string) => {
      onUpdate(field.id, { rawExpression: expression })
    },
    [field.id, onUpdate],
  )

  // Handle arithmetic expression change
  const handleArithmeticChange = useCallback(
    (arithmetic: TransformArithmeticExpression | undefined) => {
      onUpdate(field.id, { arithmeticExpression: arithmetic })
    },
    [field.id, onUpdate],
  )

  // Handle remove
  const handleRemove = useCallback(() => {
    onRemove(field.id)
  }, [field.id, onRemove])

  // Get current argument value
  const getArgValue = (argIndex: number): string => {
    const arg = field.functionArgs?.[argIndex]
    if (!arg) return ''
    if (arg.type === 'field') return arg.fieldName
    if (arg.type === 'literal') return String(arg.value)
    return ''
  }

  return (
    <div
      className={cn(
        'p-3 card-outline rounded-[var(--radius-large)]',
        errors && Object.keys(errors).length > 0 && 'border-[var(--color-border-critical)]',
      )}
    >
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex justify-between">
          <div className="flex justify-start gap-2 items-center p-0 mb-3">
            <span className="text-sm text-[var(--text-secondary)]">Field {index + 1}</span>
          </div>
          {/* Remove button */}
          <div className="flex">
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                className="flex-shrink-0 flex-end h-8 w-8 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex">
          <div className="flex flex-1 flex-start gap-4">
            <TypeToggle field={field} handleTypeChange={handleTypeChange} readOnly={readOnly} />

            {fieldTypeMode === 'computed' && (
              <ExpressionModeToggle
                mode={field.expressionMode || 'nested'}
                onChange={handleExpressionModeChange}
                disabled={readOnly}
              />
            )}
          </div>
        </div>
      </div>

      {/* First row - Type toggle and source/function select */}
      <div className="flex items-center gap-2 mb-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
        <div className="flex-1">
          {field.type === 'passthrough' ? (
            <SourceFieldSelect
              field={field}
              handleSourceFieldChange={handleSourceFieldChange}
              readOnly={readOnly}
              errors={errors}
              availableFields={availableFields}
              className="w-1/2"
            />
          ) : (
            <div className="flex-1">
              <TransformFunctionSelect
                field={field}
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
            </div>
          )}
        </div>
      </div>

      {/* Second row - Output field and remove button */}
      <div className="flex items-start gap-4">
        {/* Field number indicator */}
        {/* <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--surface-bg-sunken)] flex items-center justify-center text-sm font-medium text-[var(--text-secondary)]">
          {index + 1}
        </div> */}

        {/* Main content */}
        <OutputField
          field={field}
          handleOutputNameChange={handleOutputNameChange}
          readOnly={readOnly}
          errors={errors}
        />
      </div>
    </div>
  )
}

export default TransformationFieldRow
