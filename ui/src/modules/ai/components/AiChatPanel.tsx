'use client'

import React, { useRef, useEffect, KeyboardEvent } from 'react'
import { Button } from '@/src/components/ui/button'
import { Textarea } from '@/src/components/ui/textarea'
import { cn } from '@/src/utils/common.client'
import type { ChatMessage } from '@/src/modules/ai/types'

interface AiChatPanelProps {
  messages: ChatMessage[]
  isLoading: boolean
  onSendMessage: (message: string) => void
  placeholder?: string
  disabled?: boolean
}

export function AiChatPanel({
  messages,
  isLoading,
  onSendMessage,
  placeholder = 'Tell me about your pipeline...',
  disabled = false,
}: AiChatPanelProps) {
  const [input, setInput] = React.useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading || disabled) return
    onSendMessage(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div className="max-w-xs">
              <div className="text-2xl mb-3 text-[var(--text-accent)]">✦</div>
              <p className="text-sm font-medium mb-1 text-[var(--text-primary)]">AI Pipeline Assistant</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Describe what you want to build. I'll help you configure a pipeline step by step.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--control-bg)] rounded-lg px-3 py-2 text-sm max-w-[80%]">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-[var(--surface-border)] bg-[var(--surface-bg)]">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 min-h-[60px] max-h-[120px] resize-none text-sm"
            disabled={disabled || isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || disabled}
            variant="primary"
            size="sm"
            className="h-[60px] px-4 shrink-0"
          >
            Send
          </Button>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap',
          isUser
            ? 'bg-[var(--color-background-primary)] text-[var(--color-on-background-primary)]'
            : 'bg-[var(--control-bg)] text-[var(--text-primary)]',
        )}
      >
        {message.content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center py-1">
      <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  )
}
