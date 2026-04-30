// One chat bubble. User messages right-aligned with primary tint; assistant
// messages left-aligned. Each bubble is a stack of `ContentBlock`s — text
// blocks render as paragraphs, tool-call blocks dispatch to `ToolCallCard`.

'use client'

import * as React from 'react'
import type { ChatMessage } from '@/src/modules/ai/types'
import { ToolCallCard } from './ToolCallCard'
import { cn } from '@/src/utils/common.client'

type AiMessageProps = { message: ChatMessage }

export function AiMessage({ message }: AiMessageProps) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[90%] flex flex-col gap-2 rounded-lg px-3 py-2 border',
          isUser
            ? 'bg-[var(--color-background-primary-faded)] border-[var(--color-foreground-primary-faded)]'
            : 'bg-[var(--color-background-elevation-raised-faded)] border-[var(--surface-border)]',
        )}
      >
        {message.blocks.map((block, i) => {
          if (block.kind === 'text') {
            // Text blocks may be empty during streaming; suppress an empty
            // paragraph so the bubble doesn't render an empty line.
            if (!block.text) return null
            return (
              <p
                key={i}
                className="body-3 text-[var(--text-primary)] whitespace-pre-wrap"
              >
                {block.text}
              </p>
            )
          }
          return <ToolCallCard key={block.callId} block={block} />
        })}
      </div>
    </div>
  )
}
