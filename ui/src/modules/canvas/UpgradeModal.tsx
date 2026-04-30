'use client'

import * as React from 'react'
import type { LibraryLink } from '@/src/hooks/useLibraryLinks'

type UpgradeModalProps = {
  pipelineId: string
  link: LibraryLink | null
  onClose: () => void
  onUpgraded: () => void
}

/**
 * Placeholder shell — full implementation lands in Phase 3 task 3.6
 * (schema diff + new-revision deploy). Existence here keeps task 3.5
 * (LibraryLinksTab) buildable without reaching into the next task.
 */
export function UpgradeModal(_props: UpgradeModalProps): React.ReactElement | null {
  return null
}
