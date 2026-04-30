// pipeline.draft renderer — shows the inferred draft id and an "Open in
// canvas" CTA that navigates to the URL the tool returned. The drawer stays
// open after navigation; the user can switch back at any time.

'use client'

import { useRouter } from 'next/navigation'
import type { ToolCallBlock } from '@/src/modules/ai/types'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { LayersIcon, RocketIcon, Loader2Icon } from 'lucide-react'

type Output = { draftPipelineId?: string; openInCanvasUrl?: string }

export function PipelineDraftCard({ block }: { block: ToolCallBlock }) {
  const router = useRouter()
  const output = block.output as Output | undefined

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised)] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <LayersIcon size={14} className="text-[var(--color-foreground-primary)]" />
        <span className="body-3 text-[var(--text-primary)]">Pipeline draft</span>
        {block.status === 'pending' && (
          <Loader2Icon
            size={12}
            className="animate-spin text-[var(--text-tertiary)]"
          />
        )}
        {block.status === 'success' && output?.draftPipelineId && (
          <Badge variant="success" className="ml-auto">
            <span className="mono-2">draft-{output.draftPipelineId.slice(-6)}</span>
          </Badge>
        )}
      </div>
      {block.status === 'success' && output?.openInCanvasUrl && (
        <Button
          variant="primary"
          size="sm"
          className="self-start"
          onClick={() => router.push(output.openInCanvasUrl!)}
        >
          <RocketIcon size={12} className="mr-1.5" />
          Open in canvas
        </Button>
      )}
      {block.status === 'error' && (
        <span className="caption-1 text-[var(--color-foreground-critical)]">
          {block.errorMessage ?? 'Draft failed.'}
        </span>
      )}
    </div>
  )
}
