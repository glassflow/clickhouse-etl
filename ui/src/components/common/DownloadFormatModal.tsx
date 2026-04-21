'use client'

import { useState } from 'react'
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
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { cn } from '@/src/utils/common.client'

export type DownloadFormat = 'yaml' | 'json'

interface DownloadFormatModalProps {
  visible: boolean
  onDownload: (format: DownloadFormat) => void
  onCancel: () => void
  hasUnsavedChanges?: boolean
  isDownloading?: boolean
}

export function DownloadFormatModal({
  visible,
  onDownload,
  onCancel,
  hasUnsavedChanges = false,
  isDownloading = false,
}: DownloadFormatModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>('yaml')

  return (
    <Dialog open={visible} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-4">Download Configuration</DialogTitle>
          <DialogDescription className="modal-description mb-4">
            Choose the format for your pipeline configuration file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasUnsavedChanges && (
            <div className="p-3 rounded-lg bg-[var(--color-background-warning-faded)] border border-[var(--color-border-warning)] flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-[var(--color-foreground-warning)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--text-secondary)]">
                You have unsaved changes. The downloaded configuration reflects the currently deployed version, not your pending edits.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSelectedFormat('yaml')}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all',
                selectedFormat === 'yaml'
                  ? 'border-[var(--control-border-focus)] bg-[var(--color-background-primary)] text-[var(--color-on-background-primary)]'
                  : 'border-[var(--control-border)] bg-[var(--surface-bg)] text-[var(--text-primary)] hover:border-[var(--control-border-hover)] hover:bg-[var(--surface-bg-raised)]',
              )}
            >
              <span className="text-base font-mono font-bold">.yaml</span>
              <span
                className={cn(
                  'text-xs',
                  selectedFormat === 'yaml' ? 'text-[var(--color-on-background-primary)]' : 'text-[var(--text-secondary)]',
                )}
              >
                Recommended
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('json')}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all',
                selectedFormat === 'json'
                  ? 'border-[var(--control-border-focus)] bg-[var(--color-background-primary)] text-[var(--color-on-background-primary)]'
                  : 'border-[var(--control-border)] bg-[var(--surface-bg)] text-[var(--text-primary)] hover:border-[var(--control-border-hover)] hover:bg-[var(--surface-bg-raised)]',
              )}
            >
              <span className="text-base font-mono font-bold">.json</span>
              <span
                className={cn(
                  'text-xs',
                  selectedFormat === 'json' ? 'text-[var(--color-on-background-primary)]' : 'text-[var(--text-secondary)]',
                )}
              >
                Also supported
              </span>
            </button>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="tertiary" size="custom" onClick={onCancel} disabled={isDownloading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="custom"
            onClick={() => onDownload(selectedFormat)}
            loading={isDownloading}
            loadingText="Downloading..."
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
