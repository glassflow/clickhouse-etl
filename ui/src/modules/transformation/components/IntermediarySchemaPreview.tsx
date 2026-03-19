'use client'

import React from 'react'
import { Label } from '@/src/components/ui/label'
import { CheckCircleIcon, XCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { TransformationConfig } from '@/src/store/transformation.store'
import { TransformationConfigValidation, getIntermediarySchema } from '../utils'

export interface ValidationErrorDetail {
  fieldName: string
  errors: string[]
}

export interface IntermediarySchemaPreviewProps {
  /** Current transformation configuration */
  config: TransformationConfig
  /** Validation state */
  validation: TransformationConfigValidation
  /** Whether a save has been attempted (kept for compatibility, no longer used for error display) */
  saveAttempted?: boolean
  /** Structured error details */
  validationErrorDetails: ValidationErrorDetail[]
  /** Total error count */
  totalErrorCount: number
  /** Whether validation details are expanded */
  isValidationExpanded: boolean
  /** Toggle validation expansion */
  onToggleValidationExpanded: () => void
}

/**
 * Displays a preview of the intermediary schema that will be generated
 * from the transformation configuration, along with validation status.
 */
export function IntermediarySchemaPreview({
  config,
  validation,
  validationErrorDetails,
  totalErrorCount,
  isValidationExpanded,
  onToggleValidationExpanded,
}: IntermediarySchemaPreviewProps) {
  const schemaFields = getIntermediarySchema(config)

  return (
    <div className="mt-6 p-4 card-outline rounded-[var(--radius-xl)] space-y-2">
      {/* Header with validation status */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-[var(--text-secondary)]">
          Intermediary Schema Preview
        </Label>
        {validation.isValid ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-positive)]">
            <CheckCircleIcon className="w-4 h-4" />
            Valid configuration
          </div>
        ) : totalErrorCount > 0 ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={onToggleValidationExpanded}
              className="flex items-center gap-2 text-sm text-[var(--color-foreground-critical)] hover:text-[var(--color-foreground-critical-hover)] transition-colors cursor-pointer"
            >
              <XCircleIcon className="w-4 h-4" />
              <span>
                {totalErrorCount} {totalErrorCount === 1 ? 'issue' : 'issues'} found
              </span>
              <ChevronDownIcon
                className={`w-4 h-4 transition-transform duration-200 ${isValidationExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        ) : null}
      </div>

      {/* Schema Table */}
      <div className="text-sm font-mono p-3 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-md)] border border-[var(--surface-border)] overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-xs text-[var(--text-disabled)] border-b border-[var(--surface-border)]">
              <th className="text-left py-1 pr-4 font-medium w-[35%]">Field Name</th>
              <th className="text-left py-1 pr-4 font-medium w-[20%]">Type</th>
              <th className="text-left py-1 font-medium w-[45%]">Source</th>
            </tr>
          </thead>
          <tbody>
            {schemaFields.map((field, idx) => (
              <tr key={idx} className="border-b border-[var(--surface-border)] last:border-b-0">
                <td className="py-1.5 pr-4 text-[var(--color-foreground-primary)]">{field.name}</td>
                <td className="py-1.5 pr-4 text-[var(--text-secondary)]">{field.type}</td>
                <td className="py-1.5 text-[var(--text-secondary)]">
                  {field.sourceField && <span>← {field.sourceField}</span>}
                  {field.functionName && (
                    <span className="text-[var(--text-accent)]">fn: {field.functionName}()</span>
                  )}
                  {field.rawExpression && (
                    <span className="text-[var(--text-accent)] font-mono text-xs" title={field.rawExpression}>
                      raw:{' '}
                      {field.rawExpression.length > 40
                        ? `${field.rawExpression.substring(0, 40)}...`
                        : field.rawExpression}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expandable validation error details */}
      {!validation.isValid && isValidationExpanded && totalErrorCount > 0 && (
        <div className="mt-3 p-3 bg-[var(--color-background-critical-subtle)] border border-[var(--color-border-critical)] rounded-[var(--radius-md)] animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-3">
            {/* Global errors */}
            {validation.globalErrors.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-[var(--color-foreground-critical)] uppercase tracking-wide mb-1.5">
                  Configuration Errors
                </div>
                <ul className="space-y-1">
                  {validation.globalErrors.map((error, i) => (
                    <li
                      key={i}
                      className="text-sm text-[var(--color-foreground-critical)] flex items-start gap-2"
                    >
                      <span className="text-[var(--color-foreground-critical)] mt-0.5">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Field-specific errors */}
            {validationErrorDetails.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-[var(--color-foreground-critical)] uppercase tracking-wide mb-1.5">
                  Field Errors
                </div>
                <div className="space-y-2">
                  {validationErrorDetails.map((detail, idx) => (
                    <div key={idx} className="pl-3 border-l-2 border-[var(--color-border-critical)]">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {detail.fieldName}
                      </div>
                      <ul className="mt-0.5 space-y-0.5">
                        {detail.errors.map((error, errorIdx) => (
                          <li
                            key={errorIdx}
                            className="text-sm text-[var(--color-foreground-critical)] flex items-start gap-2"
                          >
                            <span className="text-[var(--color-foreground-critical)] mt-0.5">→</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default IntermediarySchemaPreview
