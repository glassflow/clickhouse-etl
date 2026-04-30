// Dispatcher for the three tool kinds. Adding a new tool means adding a
// `<XxxCard>` and a case here — the chat panel does not need to know.

'use client'

import type { ToolCallBlock } from '@/src/modules/ai/types'
import { PipelineDraftCard } from './PipelineDraftCard'
import { LibrarySearchCard } from './LibrarySearchCard'
import { ValidateCard } from './ValidateCard'

type ToolCallCardProps = { block: ToolCallBlock }

export function ToolCallCard({ block }: ToolCallCardProps) {
  switch (block.tool) {
    case 'pipeline.draft':
      return <PipelineDraftCard block={block} />
    case 'library.search':
      return <LibrarySearchCard block={block} />
    case 'validate':
      return <ValidateCard block={block} />
  }
}
