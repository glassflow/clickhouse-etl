'use client'

import React, { useState, useCallback } from 'react'
import { Label } from '@/src/components/ui/label'
import { Textarea } from '@/src/components/ui/textarea'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { TRANSFORMATION_FUNCTIONS, getCategoryLabel, getCategories } from '../functions'
import { cn } from '@/src/utils/common.client'

interface RawExpressionEditorProps {
  expression: string
  availableFields: Array<{ name: string; type: string }>
  onChange: (expression: string) => void
  disabled?: boolean
  error?: string
}

export function RawExpressionEditor({
  expression,
  availableFields,
  onChange,
  disabled = false,
  error,
}: RawExpressionEditorProps) {
  const [showFieldsRef, setShowFieldsRef] = useState(false)
  const [showFunctionsRef, setShowFunctionsRef] = useState(false)

  // Handle expression change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
    },
    [onChange],
  )

  // Insert field name at cursor position
  const handleInsertField = useCallback(
    (fieldName: string) => {
      const textarea = document.getElementById('raw-expression-textarea') as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = expression.slice(0, start) + fieldName + expression.slice(end)
        onChange(newValue)
        // Reset cursor position
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + fieldName.length, start + fieldName.length)
        }, 0)
      } else {
        onChange(expression + fieldName)
      }
    },
    [expression, onChange],
  )

  // Insert function template
  const handleInsertFunction = useCallback(
    (funcName: string, argCount: number) => {
      const args = Array(argCount).fill('').join(', ')
      const template = `${funcName}(${args})`
      const textarea = document.getElementById('raw-expression-textarea') as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = expression.slice(0, start) + template + expression.slice(end)
        onChange(newValue)
        // Position cursor inside first argument
        setTimeout(() => {
          textarea.focus()
          const cursorPos = start + funcName.length + 1
          textarea.setSelectionRange(cursorPos, cursorPos)
        }, 0)
      } else {
        onChange(expression + template)
      }
    },
    [expression, onChange],
  )

  const categories = getCategories()

  return (
    <div className="space-y-3">
      {/* Expression textarea */}
      <div className="space-y-1">
        <Label className="text-xs text-[var(--text-secondary)] block">Expression</Label>
        <Textarea
          id="raw-expression-textarea"
          value={expression}
          onChange={handleChange}
          placeholder='Enter expression (e.g., toInt(getQueryParam(field, "param")) != 0 ? value1 : value2)'
          disabled={disabled}
          rows={3}
          error={!!error}
          className="font-mono text-sm resize-y"
        />
        {error && <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{error}</p>}
      </div>

      {/* Preview */}
      {expression && (
        <div className="space-y-1">
          <Label className="text-xs text-[var(--text-secondary)] block">Preview</Label>
          <code className="block text-xs font-mono p-2 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-md)] border border-[var(--surface-border)] break-all max-h-20 overflow-auto">
            {expression}
          </code>
        </div>
      )}

      {/* Reference sections */}
      <div className="space-y-2">
        {/* Available fields reference */}
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
                      onClick={() => !disabled && handleInsertField(field.name)}
                      className={cn(
                        'chip chip-neutral-faded font-mono cursor-pointer',
                        disabled && 'opacity-50 cursor-not-allowed',
                        !disabled && 'hover:opacity-80',
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

        {/* Available functions reference */}
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
                          onClick={() => !disabled && handleInsertFunction(func.name, func.args.length)}
                          title={func.description}
                          className={cn(
                            'chip chip-neutral-faded font-mono cursor-pointer',
                            disabled && 'opacity-50 cursor-not-allowed',
                            !disabled && 'hover:opacity-80',
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

      {/* Syntax hints */}
      <div className="text-xs text-[var(--text-secondary)] space-y-1">
        <p className="font-medium">Expression syntax examples:</p>
        <ul className="list-disc ml-4 space-y-0.5">
          <li>
            <code className="font-mono bg-[var(--surface-bg-sunken)] px-1 rounded">toInt(field)</code> - Type conversion
          </li>
          <li>
            <code className="font-mono bg-[var(--surface-bg-sunken)] px-1 rounded">getQueryParam(query, "param")</code>{' '}
            - Extract parameter
          </li>
          <li>
            <code className="font-mono bg-[var(--surface-bg-sunken)] px-1 rounded">condition ? value1 : value2</code> -
            Ternary expression
          </li>
          <li>
            <code className="font-mono bg-[var(--surface-bg-sunken)] px-1 rounded">value != 0 ? value : default</code> -
            Conditional with default
          </li>
        </ul>
      </div>
    </div>
  )
}

export default RawExpressionEditor
