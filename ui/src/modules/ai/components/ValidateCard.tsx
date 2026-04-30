// validate renderer — single-line summary of the canvas validation result.

'use client'

import type { ToolCallBlock } from '@/src/modules/ai/types'
import { CheckCircle2Icon, AlertCircleIcon, Loader2Icon } from 'lucide-react'

type Output = {
  summary?: { errorCount?: number; warningCount?: number; hasErrors?: boolean }
}

export function ValidateCard({ block }: { block: ToolCallBlock }) {
  const output = block.output as Output | undefined
  const summary = output?.summary

  let icon: React.ReactNode
  let label: string
  if (block.status === 'pending') {
    icon = (
      <Loader2Icon size={12} className="animate-spin text-[var(--text-tertiary)]" />
    )
    label = 'Validating…'
  } else if (block.status === 'error') {
    icon = (
      <AlertCircleIcon size={14} className="text-[var(--color-foreground-critical)]" />
    )
    label = block.errorMessage ?? 'Validation failed.'
  } else if (summary?.hasErrors) {
    icon = (
      <AlertCircleIcon size={14} className="text-[var(--color-foreground-critical)]" />
    )
    label = `${summary.errorCount ?? 0} errors, ${summary.warningCount ?? 0} warnings`
  } else {
    icon = (
      <CheckCircle2Icon size={14} className="text-[var(--color-foreground-positive)]" />
    )
    label = `Valid (${summary?.warningCount ?? 0} warnings)`
  }

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised)] p-3 flex items-center gap-2">
      {icon}
      <span className="body-3 text-[var(--text-primary)]">{label}</span>
    </div>
  )
}
