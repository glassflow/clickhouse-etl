import { cn } from '@/src/utils/common.client'

type LiveIndicatorProps = {
  active?: boolean
  label?: string
  className?: string
}

export function LiveIndicator({ active = true, label = 'live', className }: LiveIndicatorProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 caption-1', className)}>
      <span className="relative inline-flex w-2 h-2" aria-hidden="true">
        {active && (
          <span className="absolute inset-0 rounded-full bg-[var(--obs-live-dot)] opacity-50 animate-livePulse" />
        )}
        <span
          className={cn(
            'relative inline-flex w-2 h-2 rounded-full',
            active ? 'bg-[var(--obs-live-dot)]' : 'bg-[var(--color-foreground-disabled)]',
          )}
        />
      </span>
      <span
        className={
          active
            ? 'text-[var(--color-foreground-primary)]'
            : 'text-[var(--color-foreground-neutral-faded)]'
        }
      >
        {label}
      </span>
    </span>
  )
}
