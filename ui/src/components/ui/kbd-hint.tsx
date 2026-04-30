import { cn } from '@/src/utils/common.client'

type KbdHintProps = {
  keys: string[]
  className?: string
}

export function KbdHint({ keys, className }: KbdHintProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden="true">
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="mono-2 px-1.5 py-0.5 rounded border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] text-[var(--color-foreground-neutral-faded)]"
        >
          {k}
        </kbd>
      ))}
    </span>
  )
}
