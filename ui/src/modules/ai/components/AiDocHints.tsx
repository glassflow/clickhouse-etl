'use client'

import React from 'react'
import type { DocHintItem } from '@/src/modules/ai/types'

interface AiDocHintsProps {
  hints: DocHintItem[]
}

export function AiDocHints({ hints }: AiDocHintsProps) {
  if (!hints.length) return null

  return (
    <div className="px-4 py-3 border-t border-[var(--surface-border)]">
      <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">Docs</p>
      <div className="space-y-1.5">
        {hints.map((hint, i) => (
          <a
            key={i}
            href={hint.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-2 items-start text-xs text-[var(--text-link)] hover:underline"
          >
            <span className="shrink-0 mt-0.5">↗</span>
            <span>{hint.title}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
