import { cn } from '@/src/utils/common.client'

type ScopeBadgeProps = {
  pipelineId: string
  className?: string
}

export function ScopeBadge({ pipelineId, className }: ScopeBadgeProps) {
  return (
    <span
      title={pipelineId}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded',
        'border border-[var(--color-foreground-primary-faded)]',
        'bg-[var(--color-orange-alpha-10)]',
        'text-[var(--color-foreground-primary)] caption-1',
        className,
      )}
      aria-label={`Query scope locked to pipeline ${pipelineId}`}
    >
      <span>scoped:</span>
      <span className="mono-2 max-w-[160px] truncate">{pipelineId}</span>
    </span>
  )
}
