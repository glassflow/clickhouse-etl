'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { ModalResult } from '@/src/components/common/InfoModal'
import { PipelineUpload } from './PipelineUpload'
import { ExclamationTriangleIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { ImportValidationResult } from '@/src/utils/pipeline-import'
import type { Pipeline } from '@/src/types/pipeline'

export interface UploadPipelineModalProps {
  visible: boolean
  onComplete: (result: string, config?: Pipeline, rawJson?: string) => void
  isNavigating?: boolean
  /** Error message when import/hydration failed (e.g. after clicking Import & Continue) */
  importError?: string | null
  /** Called when user should dismiss or retry so the error can be cleared */
  onClearImportError?: () => void
}

export function UploadPipelineModal({
  visible,
  onComplete,
  isNavigating = false,
  importError = null,
  onClearImportError,
}: UploadPipelineModalProps) {
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null)
  const [rawJson, setRawJson] = useState<string>('')
  const [errors, setErrors] = useState<string[]>([])

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setValidationResult(null)
      setRawJson('')
      setErrors([])
      onClearImportError?.()
    }

  }, [visible])

  const handleValidConfig = useCallback(
    (result: ImportValidationResult, json: string) => {
      setValidationResult(result)
      setRawJson(json)
      setErrors([])
      onClearImportError?.()
    },
    [onClearImportError],
  )

  const handleError = useCallback(
    (errs: string[]) => {
      setErrors(errs)
      setValidationResult(null)
      setRawJson('')
      onClearImportError?.()
    },
    [onClearImportError],
  )

  const handleCancel = useCallback(() => {
    onComplete(ModalResult.CANCEL)
  }, [onComplete])

  const handleImport = useCallback(() => {
    if (validationResult?.valid && validationResult.config) {
      onComplete(ModalResult.YES, validationResult.config, rawJson)
    }
  }, [validationResult, rawJson, onComplete])

  const isImportDisabled = !validationResult?.valid || isNavigating

  return (
    <Dialog
      open={visible}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleCancel()
      }}
    >
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-4">Import Pipeline Configuration</DialogTitle>
          <DialogDescription className="modal-description mb-4">
            Upload a pipeline configuration JSON file or paste the configuration directly. The configuration will be
            validated and used to pre-fill the pipeline wizard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Import/hydration error (e.g. failed when clicking Import & Continue) */}
          {importError && (
            <div
              className="p-4 rounded-lg bg-[var(--color-background-critical-faded)] border border-[var(--color-border-critical)] flex items-start gap-3"
              role="alert"
            >
              <ExclamationTriangleIcon className="w-5 h-5 text-[var(--color-foreground-critical)] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-[var(--color-foreground-critical)] mb-1">Import failed</h4>
                <p className="text-sm text-[var(--text-secondary)]">{importError}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  Fix the configuration or try a different file, then try again.
                </p>
              </div>
              <button
                type="button"
                onClick={onClearImportError}
                className="p-1 rounded hover:bg-[var(--color-background-critical)] text-[var(--color-foreground-critical)]"
                aria-label="Dismiss error"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          <PipelineUpload onValidConfig={handleValidConfig} onError={handleError} disabled={isNavigating} />

          {/* Success state with config summary */}
          {validationResult?.valid && validationResult.config && (
            <div className="p-4 rounded-lg bg-[var(--color-background-positive-faded)] border border-[var(--color-border-positive)]">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-[var(--color-foreground-positive)] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-[var(--color-foreground-positive)] mb-2">
                    Configuration Valid
                  </h4>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-[var(--text-secondary)]">Pipeline Name:</dt>
                    <dd className="text-[var(--text-primary)] font-medium truncate">{validationResult.pipelineName}</dd>

                    <dt className="text-[var(--text-secondary)]">Topics:</dt>
                    <dd className="text-[var(--text-primary)]">
                      {validationResult.topicCount} topic{validationResult.topicCount !== 1 ? 's' : ''}
                    </dd>

                    <dt className="text-[var(--text-secondary)]">Pipeline Type:</dt>
                    <dd className="text-[var(--text-primary)]">
                      {validationResult.topicCount === 2 ? 'Multi-Topic (Join)' : 'Single-Topic'}
                    </dd>
                  </dl>

                  {/* Warnings */}
                  {validationResult.warnings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border-positive)]">
                      <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-[var(--color-foreground-warning)] flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-medium text-[var(--color-foreground-warning)]">Warnings:</span>
                          <ul className="mt-1 text-xs text-[var(--text-secondary)] space-y-0.5">
                            {validationResult.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="tertiary" size="custom" onClick={handleCancel} disabled={isNavigating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="custom"
            onClick={handleImport}
            disabled={isImportDisabled}
            title={
              isNavigating
                ? 'Importing configuration...'
                : !validationResult?.valid
                  ? 'Please upload a valid configuration first'
                  : undefined
            }
          >
            {isNavigating ? 'Importing...' : 'Import & Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
