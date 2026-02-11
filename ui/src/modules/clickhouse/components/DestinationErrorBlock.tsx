import { Button } from '@/src/components/ui/button'
import { XCircleIcon } from '@heroicons/react/24/outline'
import DownloadIconWhite from '@/src/images/download-white.svg'
import Image from 'next/image'

interface DestinationErrorBlockProps {
  /** Combined error message to display */
  error: string | null
  /** Failed deployment config object (when present, shows download button) */
  failedDeploymentConfig: any | null
  /** Callback to download the failed configuration */
  onDownloadConfig: () => void
}

/**
 * Displays error messages and a download button for failed deployments.
 * Used in ClickhouseMapper to show combined errors from database/table/schema fetching
 * and deployment failures.
 */
export function DestinationErrorBlock({
  error,
  failedDeploymentConfig,
  onDownloadConfig,
}: DestinationErrorBlockProps) {
  if (!error) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-background-neutral-faded text-[var(--text-error)] rounded-md flex items-center border border-[var(--color-border-neutral-faded)]">
        <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
        <span>{error}</span>
      </div>
      {/* Show download button when deployment fails */}
      {failedDeploymentConfig && (
        <div className="flex items-center gap-3 p-3 bg-background-neutral-faded rounded-md border border-[var(--color-border-neutral-faded)] text-content">
          <span className="text-sm text-muted-foreground">
            You can download the configuration to save your work and try again later.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadConfig}
            className="group flex items-center gap-2 whitespace-nowrap btn-action !px-3 !py-2 text-sm h-auto"
          >
            <Image
              src={DownloadIconWhite}
              alt="Download"
              width={16}
              height={16}
              className="filter brightness-100 group-hover:brightness-0 flex-shrink-0"
            />
            Download config
          </Button>
        </div>
      )}
    </div>
  )
}
