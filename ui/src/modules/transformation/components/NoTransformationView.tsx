'use client'

import React from 'react'

export interface NoTransformationViewProps {
  readOnly: boolean
  hasAvailableFields: boolean
}

/**
 * Displays an empty state view when no transformations are configured.
 * Shows different messaging based on whether the user can add fields.
 */
export function NoTransformationView({ readOnly, hasAvailableFields }: NoTransformationViewProps) {
  return (
    <div className="space-y-4">
      <div className="p-6 card-outline rounded-[var(--radius-xl)] text-center">
        <div className="text-[var(--color-foreground-neutral-faded)] mb-2">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
            />
          </svg>
          <p className="text-lg font-medium">No Transformations Configured</p>
          <p className="text-sm mt-1">All fields will be passed through unchanged to the mapping step.</p>
        </div>
        {!readOnly && hasAvailableFields && (
          <p className="text-sm text-[var(--text-secondary)] mt-4">
            Click the buttons below to add computed or passthrough fields.
          </p>
        )}
      </div>
    </div>
  )
}

export default NoTransformationView
