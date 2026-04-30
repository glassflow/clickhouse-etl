'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, XIcon } from 'lucide-react'
import { useLibraryLinks } from '@/src/hooks/useLibraryLinks'
import { Button } from '@/src/components/ui/button'

type DriftBannerProps = {
  pipelineId: string | null
}

/**
 * Surfaces drift on the Canvas: when the pipeline's pinned references differ
 * from the latest published versions in the Library, render a single banner
 * row above the graph with a sample of the drifted resource and a CTA that
 * jumps to the Library Links tab. Dismissable per session.
 */
export function DriftBanner({ pipelineId }: DriftBannerProps) {
  const { links, driftCount, isLoading } = useLibraryLinks(pipelineId)
  const [dismissed, setDismissed] = React.useState(false)

  if (isLoading || !pipelineId || dismissed || driftCount === 0) return null

  const driftedLinks = links.filter((l) => l.drift !== 'none')
  const sample = driftedLinks[0]
  if (!sample) return null
  const more = driftedLinks.length - 1

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 px-4 py-2 border border-[var(--obs-drift-minor)] bg-[color-mix(in_srgb,var(--obs-drift-minor)_10%,var(--color-background-elevation-raised-faded))] rounded-md"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangleIcon
          size={14}
          className="text-[var(--obs-drift-minor)] shrink-0"
          aria-hidden="true"
        />
        <span className="body-3 text-[var(--text-primary)] truncate">
          {sample.resourceName ?? sample.resourceId} has{' '}
          <span className="mono-2">{sample.latestVersion ?? '—'}</span>; this pipeline is pinned
          to <span className="mono-2">{sample.pinnedVersion ?? '—'}</span>
          {more > 0 && (
            <span className="text-[var(--text-tertiary)]"> · +{more} more</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild variant="primary" size="sm">
          <Link href={`/pipelines/${pipelineId}/library-links`}>
            Review {driftCount} upgrade{driftCount === 1 ? '' : 's'}
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss drift banner"
          onClick={() => setDismissed(true)}
        >
          <XIcon size={14} />
        </Button>
      </div>
    </div>
  )
}
