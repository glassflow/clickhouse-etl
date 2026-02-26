'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Label } from '@/src/components/ui/label'
import { Textarea } from '@/src/components/ui/textarea'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { ChevronDownIcon, ChevronUpIcon, PlayIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { TRANSFORMATION_FUNCTIONS, getCategoryLabel, getCategories } from '../functions'
import { fieldToExpr } from '../utils'
import { evaluateExpression } from '@/src/api/pipeline-api'
import type { TransformationField } from '@/src/store/transformation.store'
import { cn } from '@/src/utils/common.client'

/** Props when used as a per-field playground (single field, no selector) */
export interface ExpressionPlaygroundSingleFieldProps {
  singleFieldMode: true
  availableFields: Array<{ name: string; type: string }>
  sampleEvent: Record<string, unknown> | null
  expression: string
  onExpressionChange: (value: string) => void
  outputName: string
  outputType: string
  onApplyExpression: (expression: string) => void
  readOnly?: boolean
  /** Unique id for textarea (e.g. field id) to avoid duplicate ids when multiple rows render playground */
  textareaId?: string
}

/** Props when used as a global playground (field selector) */
export interface ExpressionPlaygroundMultiFieldProps {
  singleFieldMode?: false
  availableFields: Array<{ name: string; type: string }>
  sampleEvent: Record<string, unknown> | null
  configuredFields: TransformationField[]
  onApplyExpression: (fieldId: string, expression: string) => void
  readOnly?: boolean
}

export type ExpressionPlaygroundProps = ExpressionPlaygroundSingleFieldProps | ExpressionPlaygroundMultiFieldProps

type EvalStatus = 'idle' | 'evaluating' | 'valid' | 'invalid'

export function ExpressionPlayground(props: ExpressionPlaygroundProps) {
  const {
    availableFields,
    sampleEvent,
    readOnly = false,
  } = props

  const singleFieldMode = props.singleFieldMode === true

  // In single-field mode expression is controlled; in multi-field we use internal state
  const [multiFieldExpression, setMultiFieldExpression] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [status, setStatus] = useState<EvalStatus>('idle')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFieldsRef, setShowFieldsRef] = useState(false)
  const [showFunctionsRef, setShowFunctionsRef] = useState(false)

  const expression = singleFieldMode ? props.expression : multiFieldExpression
  const handleExpressionChange = singleFieldMode
    ? (value: string) => {
        setStatus('idle')
        setError(null)
        setResult(null)
        props.onExpressionChange(value)
      }
    : (value: string) => {
        setMultiFieldExpression(value)
        setStatus('idle')
        setError(null)
        setResult(null)
      }

  const selectedField =
    !singleFieldMode && props.configuredFields && selectedFieldId
      ? props.configuredFields.find((f) => f.id === selectedFieldId)
      : null

  // When selected field changes (multi-field mode only), load its expression
  useEffect(() => {
    if (singleFieldMode) return
    if (!selectedField) {
      setMultiFieldExpression('')
      setResult(null)
      setError(null)
      setStatus('idle')
      return
    }
    const expr = fieldToExpr(selectedField)
    setMultiFieldExpression(expr)
    setResult(null)
    setError(null)
    setStatus('idle')
  }, [singleFieldMode, selectedFieldId, selectedField?.id])

  const textareaId = singleFieldMode && props.textareaId
    ? `playground-expression-${props.textareaId}`
    : 'playground-expression-textarea'

  const handleInsertField = useCallback(
    (fieldName: string) => {
      const textarea = document.getElementById(textareaId) as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = expression.slice(0, start) + fieldName + expression.slice(end)
        handleExpressionChange(newValue)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + fieldName.length, start + fieldName.length)
        }, 0)
      } else {
        handleExpressionChange(expression + fieldName)
      }
    },
    [expression, handleExpressionChange, textareaId],
  )

  const handleInsertFunction = useCallback(
    (funcName: string, argCount: number) => {
      const args = Array(argCount).fill('').join(', ')
      const template = `${funcName}(${args})`
      const textarea = document.getElementById(textareaId) as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = expression.slice(0, start) + template + expression.slice(end)
        handleExpressionChange(newValue)
        setTimeout(() => {
          textarea.focus()
          const cursorPos = start + funcName.length + 1
          textarea.setSelectionRange(cursorPos, cursorPos)
        }, 0)
      } else {
        handleExpressionChange(expression + template)
      }
    },
    [expression, handleExpressionChange, textareaId],
  )

  const outputName = singleFieldMode ? props.outputName : (selectedField?.outputFieldName ?? 'result')
  const outputType = singleFieldMode ? props.outputType : (selectedField?.outputFieldType ?? 'string')

  const handleRun = useCallback(async () => {
    if (!sampleEvent || Object.keys(sampleEvent).length === 0) {
      setError('Load a sample event in the previous step to run the expression.')
      setStatus('invalid')
      return
    }
    if (!expression.trim()) {
      setError('Enter an expression to evaluate.')
      setStatus('invalid')
      return
    }
    setStatus('evaluating')
    setError(null)
    setResult(null)
    const res = await evaluateExpression(expression.trim(), outputName, outputType, sampleEvent)
    if (res.valid) {
      setStatus('valid')
      setResult(res.result ?? null)
      setError(null)
    } else {
      setStatus('invalid')
      setError(res.error ?? 'Evaluation failed')
      setResult(null)
    }
  }, [expression, sampleEvent, outputName, outputType])

  const handleApplyMultiField = useCallback(() => {
    if (!selectedFieldId || !expression.trim() || readOnly) return
    props.onApplyExpression(selectedFieldId, expression.trim())
  }, [selectedFieldId, expression, readOnly, props])

  const handleApplySingleField = useCallback(() => {
    if (!expression.trim() || readOnly) return
    ;(props as ExpressionPlaygroundSingleFieldProps).onApplyExpression(expression.trim())
  }, [expression, readOnly, props])

  const categories = getCategories()
  const canRun = expression.trim().length > 0
  const canApplyMulti = !readOnly && selectedFieldId && expression.trim().length > 0
  const canApplySingle = singleFieldMode && !readOnly && expression.trim().length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header: field selector (multi only) + actions */}
      <div className="flex flex-wrap items-center gap-3">
        {!singleFieldMode && (
          <div className="flex items-center gap-2 min-w-0">
            <Label className="text-xs text-[var(--text-secondary)] whitespace-nowrap">Field</Label>
            <Select
              value={selectedFieldId ?? ''}
              onValueChange={(v) => setSelectedFieldId(v || null)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select a field to edit expression" />
              </SelectTrigger>
              <SelectContent>
                {props.configuredFields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.outputFieldName || f.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {singleFieldMode && canApplySingle && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleApplySingleField}
            className="flex items-center gap-1.5"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Apply
          </Button>
        )}
        {!singleFieldMode && canApplyMulti && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleApplyMultiField}
            className="flex items-center gap-1.5"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Apply to field
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={handleRun}
          disabled={!canRun || status === 'evaluating'}
          className="flex items-center gap-1.5"
        >
          {status === 'evaluating' ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Run
            </>
          ) : (
            <>
              <PlayIcon className="h-4 w-4" />
              Run
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: expression editor + fields + functions */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-[var(--text-secondary)] block">Expression</Label>
            <Textarea
              id={textareaId}
              value={expression}
              onChange={(e) => handleExpressionChange(e.target.value)}
              placeholder='e.g. toInt(field) != 0 ? field : "default"'
              disabled={readOnly}
              rows={5}
              className="font-mono text-sm resize-y"
            />
          </div>

          <div className="card-outline rounded-[var(--radius-md)]">
            <button
              type="button"
              onClick={() => setShowFieldsRef(!showFieldsRef)}
              className="w-full flex items-center justify-between p-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover-bg)]"
            >
              <span>Available Fields ({availableFields.length})</span>
              {showFieldsRef ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            {showFieldsRef && (
              <div className="p-2 pt-0 space-y-1 max-h-32 overflow-auto">
                {availableFields.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] italic">No fields available</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {availableFields.map((field) => (
                      <Badge
                        key={field.name}
                        onClick={() => !readOnly && handleInsertField(field.name)}
                        className={cn(
                          'chip chip-neutral-faded font-mono cursor-pointer',
                          readOnly && 'opacity-50 cursor-not-allowed',
                          !readOnly && 'hover:opacity-80',
                        )}
                      >
                        {field.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card-outline rounded-[var(--radius-md)]">
            <button
              type="button"
              onClick={() => setShowFunctionsRef(!showFunctionsRef)}
              className="w-full flex items-center justify-between p-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover-bg)]"
            >
              <span>Available Functions ({TRANSFORMATION_FUNCTIONS.length})</span>
              {showFunctionsRef ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            {showFunctionsRef && (
              <div className="p-2 pt-0 space-y-2 max-h-48 overflow-auto">
                {categories.map((category) => {
                  const funcs = TRANSFORMATION_FUNCTIONS.filter((f) => f.category === category)
                  return (
                    <div key={category}>
                      <Label className="text-xs text-[var(--text-secondary)] block mb-1">
                        {getCategoryLabel(category)}
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {funcs.map((func) => (
                          <Badge
                            key={func.name}
                            onClick={() => !readOnly && handleInsertFunction(func.name, func.args.length)}
                            title={func.description}
                            className={cn(
                              'chip chip-neutral-faded font-mono cursor-pointer',
                              readOnly && 'opacity-50 cursor-not-allowed',
                              !readOnly && 'hover:opacity-80',
                            )}
                          >
                            {func.name}()
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: sample event + result */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-[var(--text-secondary)] block">Sample Event</Label>
            <div
              className={cn(
                'rounded-[var(--radius-xl)] border overflow-auto font-mono text-xs p-3 min-h-[120px] max-h-[200px]',
                'bg-[var(--surface-bg-sunken)] border-[var(--surface-border)]',
              )}
            >
              {sampleEvent && Object.keys(sampleEvent).length > 0 ? (
                <pre className="text-[var(--text-secondary)] whitespace-pre-wrap break-words m-0">
                  {JSON.stringify(sampleEvent, null, 2)}
                </pre>
              ) : (
                <p className="text-[var(--text-disabled)] italic m-0">
                  Load a sample event in the Kafka step to see input data and run the expression.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-[var(--text-secondary)] block">Result</Label>
            <div
              className={cn(
                'card-outline rounded-[var(--radius-xl)] overflow-auto font-mono text-xs p-3 min-h-[120px] max-h-[200px]',
                status === 'valid' && 'border-[var(--color-border-positive)]',
                status === 'invalid' && 'border-[var(--color-border-critical)]',
              )}
            >
              {status === 'evaluating' && (
                <p className="text-[var(--text-secondary)] italic m-0">Evaluating...</p>
              )}
              {status === 'idle' && !result && !error && (
                <p className="text-[var(--text-disabled)] italic m-0">Run the expression to see the result.</p>
              )}
              {status === 'valid' && result !== null && (
                <pre className="text-[var(--color-foreground-positive)] whitespace-pre-wrap break-words m-0">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
              {status === 'invalid' && error && (
                <p className="text-[var(--color-foreground-critical)] m-0">{error}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExpressionPlayground
