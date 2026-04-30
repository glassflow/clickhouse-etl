import * as React from 'react'
import { AlertTriangleIcon, AlertCircleIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import type { ValidationMessage } from './canvas-validation'

type ValidationBadgeProps = {
  messages: ValidationMessage[]
  className?: string
}

export function ValidationBadge({ messages, className }: ValidationBadgeProps) {
  if (messages.length === 0) return null

  const errors = messages.filter((m) => m.severity === 'error')
  const warnings = messages.filter((m) => m.severity === 'warning')

  const hasErrors = errors.length > 0
  const severity = hasErrors ? 'error' : 'warning'
  const count = hasErrors ? errors.length : warnings.length
  const Icon = hasErrors ? AlertCircleIcon : AlertTriangleIcon

  const tooltip = messages.map((m) => `• ${m.message}`).join('\n')

  return (
    <div
      data-severity={severity}
      title={tooltip}
      aria-label={`${errors.length} errors, ${warnings.length} warnings`}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded caption-2',
        hasErrors
          ? 'bg-[var(--color-background-critical-faded)] text-[var(--color-foreground-critical)]'
          : 'bg-[var(--color-background-warning-faded)] text-[var(--color-foreground-warning)]',
        className,
      )}
    >
      <Icon size={11} aria-hidden="true" />
      <span aria-hidden="true">{count}</span>
    </div>
  )
}
