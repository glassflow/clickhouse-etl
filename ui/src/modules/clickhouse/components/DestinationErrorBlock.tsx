'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { XCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { DownloadFormatModal, type DownloadFormat } from '@/src/components/common/DownloadFormatModal'

interface DestinationErrorBlockProps {
  /** Combined error message to display */
  error: string | null
  /** Failed deployment config object (when present, shows download button) */
  failedDeploymentConfig: any | null
  /** Callback to download the failed configuration in the chosen format */
  onDownloadConfig: (format: DownloadFormat) => void
}

/**
 * Displays error messages and a format-selection download button for failed deployments.
 */
export function DestinationErrorBlock({ error, failedDeploymentConfig, onDownloadConfig }: DestinationErrorBlockProps) {
  const [showFormatModal, setShowFormatModal] = useState(false)

  if (!error) return null

  const handleDownload = (format: DownloadFormat) => {
    setShowFormatModal(false)
    onDownloadConfig(format)
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-background-neutral-faded text-[var(--text-error)] rounded-md flex items-center border border-[var(--color-border-neutral-faded)]">
        <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
        <span>{error}</span>
      </div>
      {failedDeploymentConfig && (
        <div className="flex items-center gap-3 p-3 bg-background-neutral-faded rounded-md border border-[var(--color-border-neutral-faded)] text-content">
          <span className="text-sm text-muted-foreground">
            You can download the configuration to save your work and try again later.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFormatModal(true)}
            className="group flex items-center gap-2 whitespace-nowrap btn-action !px-3 !py-2 text-sm h-auto"
          >
            <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
            Download config
          </Button>
        </div>
      )}

      <DownloadFormatModal
        visible={showFormatModal}
        onDownload={handleDownload}
        onCancel={() => setShowFormatModal(false)}
      />
    </div>
  )
}
