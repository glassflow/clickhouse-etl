'use client'

import * as React from 'react'
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'
import { useStore } from '@/src/store'
import { cn } from '@/src/utils/common.client'

type ValidationFooterProps = {
  className?: string
  onJumpToNode?: (nodeId: string) => void
}

export function ValidationFooter({ className, onJumpToNode }: ValidationFooterProps) {
  const { canvasStore } = useStore()
  const result = React.useMemo(
    () => canvasStore.validate(),
    // Recompute on changes to nodes/edges/configs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasStore.nodes, canvasStore.edges, canvasStore.nodeConfigs],
  )

  const allMessages = Object.entries(result.byNode).flatMap(([nodeId, msgs]) =>
    msgs.map((m) => ({ nodeId, ...m })),
  )

  if (allMessages.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 caption-1 text-[var(--color-foreground-positive)]',
          className,
        )}
      >
        <CheckCircle2Icon size={14} aria-hidden="true" />
        <span>Pipeline is valid.</span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1.5 px-3 py-2', className)}>
      <div className="flex items-center gap-3 caption-1">
        {result.summary.errorCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[var(--color-foreground-critical)]">
            <AlertCircleIcon size={12} aria-hidden="true" />
            {result.summary.errorCount} error{result.summary.errorCount === 1 ? '' : 's'}
          </span>
        )}
        {result.summary.warningCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[var(--color-foreground-warning)]">
            <AlertTriangleIcon size={12} aria-hidden="true" />
            {result.summary.warningCount} warning{result.summary.warningCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
        {allMessages.slice(0, 12).map((m, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onJumpToNode?.(m.nodeId)}
              className="w-full text-left caption-1 px-2 py-1 rounded hover:bg-[var(--interactive-hover-bg)] text-[var(--text-secondary)]"
            >
              <span className="mono-2 mr-2 text-[var(--text-tertiary)]">{m.nodeId}</span>
              {m.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
