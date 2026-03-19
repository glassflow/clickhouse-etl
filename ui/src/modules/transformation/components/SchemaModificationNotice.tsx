'use client'

import React from 'react'

export interface SchemaModifications {
  hasAddedFields: boolean
  hasRemovedFields: boolean
  addedCount: number
  removedCount: number
}

export interface SchemaModificationNoticeProps {
  schemaModifications: SchemaModifications
}

/**
 * Displays a notice when the schema has been modified (fields added/removed)
 * from the original Kafka event in the type verification step.
 */
export function SchemaModificationNotice({ schemaModifications }: SchemaModificationNoticeProps) {
  const { hasAddedFields, hasRemovedFields, addedCount, removedCount } = schemaModifications

  // Don't render if no modifications
  if (!hasAddedFields && !hasRemovedFields) {
    return null
  }

  return (
    <div className="text-sm text-[var(--color-foreground-neutral-faded)] bg-[var(--surface-bg-sunken)] rounded-md px-4 py-3">
      <span className="font-medium">Schema modified:</span>{' '}
      {hasAddedFields && (
        <span className="text-[var(--color-foreground-primary)]">
          {addedCount} field{addedCount !== 1 ? 's' : ''} added
        </span>
      )}
      {hasAddedFields && hasRemovedFields && ', '}
      {hasRemovedFields && (
        <span className="text-[var(--color-foreground-negative)]">
          {removedCount} field{removedCount !== 1 ? 's' : ''} removed
        </span>
      )}
      <span className="ml-1">from the original Kafka event.</span>
    </div>
  )
}

export default SchemaModificationNotice
