'use client'

import React, { useCallback, useMemo } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { TrashIcon } from '@heroicons/react/24/outline'
import { TransformationField, FunctionArg } from '@/src/store/transformation.store'
import { FunctionSelector } from './FunctionSelector'
import { getFunctionByName, TransformationFunctionDef } from '../functions'
import { inferOutputType, createFieldArg, createLiteralArg } from '../utils'
import { FieldValidation } from '../utils'
import { cn } from '@/src/utils/common.client'

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
      onUpdate(field.id, {
        type: newType,
        // Clear type-specific fields when switching
        functionName: newType === 'computed' ? '' : undefined,
        functionArgs: newType === 'computed' ? [] : undefined,
        sourceField: newType === 'passthrough' ? '' : undefined,
        sourceFieldType: newType === 'passthrough' ? '' : undefined,
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
        'p-4 card-outline rounded-[var(--radius-large)]',
        errors && Object.keys(errors).length > 0 && 'border-[var(--color-border-critical)]',
      )}
    >
      <div className="flex items-start gap-4">
        {/* Field number indicator */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--surface-bg-sunken)] flex items-center justify-center text-sm font-medium text-[var(--text-secondary)]">
          {index + 1}
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-4">
          {/* First row: Type selector and output name */}
          <div className="flex gap-4">
            {/* Type selector */}
            <div className="w-40">
              <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Type</Label>
              <Select value={field.type} onValueChange={handleTypeChange} disabled={readOnly}>
                <SelectTrigger className="input-regular input-border-regular">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="select-content-custom">
                  <SelectItem value="passthrough" className="select-item-custom">
                    Pass Through
                  </SelectItem>
                  <SelectItem value="computed" className="select-item-custom">
                    Computed
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Output field name */}
            <div className="flex-1">
              <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Output Field Name</Label>
              <Input
                value={field.outputFieldName}
                onChange={handleOutputNameChange}
                placeholder="Enter field name"
                disabled={readOnly}
                className={cn(
                  'input-regular input-border-regular',
                  errors?.outputFieldName && 'border-[var(--color-border-critical)]',
                )}
              />
              {errors?.outputFieldName && (
                <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{errors.outputFieldName}</p>
              )}
            </div>

            {/* Output type (read-only) */}
            <div className="w-32">
              <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Output Type</Label>
              <div className="input-regular input-border-regular h-10 flex items-center px-3 text-[var(--text-secondary)] bg-[var(--surface-bg-sunken)]">
                {field.outputFieldType || 'auto'}
              </div>
            </div>
          </div>

          {/* Second row: Type-specific configuration */}
          {field.type === 'passthrough' ? (
            // Passthrough configuration
            <div className="flex gap-4">
              <div className="flex-1">
                <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Source Field</Label>
                <Select value={field.sourceField || ''} onValueChange={handleSourceFieldChange} disabled={readOnly}>
                  <SelectTrigger
                    className={cn(
                      'input-regular input-border-regular',
                      errors?.sourceField && 'border-[var(--color-border-critical)]',
                    )}
                  >
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
                {errors?.sourceField && (
                  <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{errors.sourceField}</p>
                )}
              </div>
            </div>
          ) : (
            // Computed configuration
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="w-64">
                  <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Function</Label>
                  <FunctionSelector
                    value={field.functionName || ''}
                    onSelect={handleFunctionChange}
                    disabled={readOnly}
                    error={errors?.functionName}
                  />
                  {errors?.functionName && (
                    <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{errors.functionName}</p>
                  )}
                </div>
              </div>

              {/* Function arguments */}
              {functionDef && functionDef.args.length > 0 && (
                <div className="pl-4 border-l-2 border-[var(--surface-border)] space-y-2">
                  <Label className="text-xs text-[var(--text-secondary)] block">Arguments</Label>
                  {functionDef.args.map((argDef, argIndex) => (
                    <div key={argIndex} className="flex gap-2 items-center">
                      <span className="text-xs text-[var(--text-secondary)] w-24">{argDef.name}:</span>
                      {argDef.type === 'field' ? (
                        <Select
                          value={getArgValue(argIndex)}
                          onValueChange={(v) => handleArgChange(argIndex, v, 'field')}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="flex-1 input-regular input-border-regular h-8 text-sm">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent className="select-content-custom">
                            {availableFields
                              .filter((f) => !argDef.fieldTypes || argDef.fieldTypes.includes(f.type))
                              .map((f) => (
                                <SelectItem key={f.name} value={f.name} className="select-item-custom text-sm">
                                  {f.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={getArgValue(argIndex)}
                          onChange={(e) => handleArgChange(argIndex, e.target.value, 'literal')}
                          placeholder={argDef.description}
                          disabled={readOnly}
                          className="flex-1 input-regular input-border-regular h-8 text-sm"
                        />
                      )}
                    </div>
                  ))}
                  {errors?.functionArgs && (
                    <p className="text-xs text-[var(--color-foreground-critical)]">{errors.functionArgs}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Remove button */}
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            className="flex-shrink-0 h-8 w-8 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default TransformationFieldRow
