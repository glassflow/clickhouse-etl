'use client'

import React from 'react'
import { Button } from '@/src/components/ui/button'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { TransformationField } from '@/src/store/transformation.store'
import { TransformationFieldRow } from './TransformationFieldRow'
import { FieldValidation } from '../utils'

export interface AvailableField {
  name: string
  type: string
}

export interface TransformationFieldListProps {
  /** List of transformation fields */
  fields: TransformationField[]
  /** Available source fields from schema/event */
  availableFields: AvailableField[]
  /** Validation errors keyed by field ID */
  fieldErrors: Record<string, FieldValidation['errors']>
  /** Whether the component is in read-only mode */
  readOnly: boolean
  /** Number of complete fields */
  completeFieldCount: number
  /** Total number of fields */
  totalFieldCount: number
  /** Callback to update a field */
  onUpdate: (fieldId: string, updates: Partial<Omit<TransformationField, 'id'>>) => void
  /** Callback to remove a field */
  onRemove: (fieldId: string) => void
  /** Callback to clear all fields */
  onClearAll: () => void
  /** Callback to restore source fields */
  onRestoreSourceFields: () => void
  /** Callback to add a new field */
  onAddField: () => void
}

/**
 * Renders the list of transformation fields with header controls.
 * Includes field list, action buttons, and empty state.
 */
export function TransformationFieldList({
  fields,
  availableFields,
  fieldErrors,
  readOnly,
  completeFieldCount,
  totalFieldCount,
  onUpdate,
  onRemove,
  onClearAll,
  onRestoreSourceFields,
  onAddField,
}: TransformationFieldListProps) {
  return (
    <div className="space-y-4">
      {/* Header with title and action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-content">
            Transformation Fields
            {totalFieldCount > 0 && (
              <span className="ml-2 text-sm font-normal text-[var(--text-secondary)]">
                ({completeFieldCount}/{totalFieldCount} complete)
              </span>
            )}
          </h3>
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <>
              <div className="flex gap-2">
                {fields.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearAll}
                    className="btn-tertiary text-[var(--color-foreground-critical)] hover:bg-[var(--color-background-critical-subtle)]"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={onRestoreSourceFields} className="btn-tertiary">
                <PlusIcon className="h-4 w-4 mr-1" />
                Restore Source Fields
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Field List */}
      {fields.length === 0 ? (
        <div className="text-sm text-[var(--text-secondary)] text-center py-8 border border-dashed border-[var(--surface-border)] rounded-[var(--radius-medium)]">
          No fields configured. Add pass-through or computed fields using the buttons above.
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <TransformationFieldRow
              key={field.id}
              field={field}
              availableFields={availableFields}
              onUpdate={onUpdate}
              onRemove={onRemove}
              errors={fieldErrors[field.id]}
              readOnly={readOnly}
              index={index}
            />
          ))}
        </div>
      )}

      {/* Add Field Button */}
      {!readOnly && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onAddField} className="btn-tertiary">
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Field
          </Button>
        </div>
      )}
    </div>
  )
}

export default TransformationFieldList
