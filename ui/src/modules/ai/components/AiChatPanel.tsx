'use client'

import React, { useRef, useEffect, KeyboardEvent } from 'react'
import { ArrowUpIcon } from '@heroicons/react/24/solid'
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isEmpty = messages.length === 0

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isEmpty) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isEmpty])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

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

  if (isEmpty) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 pb-8">
        <div className="w-full max-w-lg">
          {/* Welcome heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-background-primary)] mb-4">
              <span className="text-[var(--color-on-background-primary)] text-lg">✦</span>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">AI Pipeline Assistant</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Describe what you want to build and I'll help you configure every step.
            </p>
          </div>

          {/* Centered input */}
          <ChatInput
            ref={textareaRef}
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            isLoading={isLoading}
          />

          {/* Suggestion chips */}
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors bg-[var(--surface-bg)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pt-4 pb-2">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input pinned at bottom */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div className="max-w-2xl mx-auto">
          <ChatInput
            ref={textareaRef}
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            placeholder="Ask a follow-up..."
            disabled={disabled || isLoading}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  'Stream Kafka → ClickHouse with dedup',
  'Ingest orders topic, dedup by order_id',
  'Connect to local Kafka, no auth',
]

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  placeholder: string
  disabled: boolean
  isLoading: boolean
}

const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(function ChatInput(
  { value, onChange, onKeyDown, onSend, placeholder, disabled, isLoading },
  ref,
) {
  return (
    <div className="relative flex items-end gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-bg)] shadow-sm px-4 py-3 focus-within:border-[var(--text-secondary)] transition-colors">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none leading-relaxed max-h-[160px] overflow-y-auto"
        disabled={disabled}
        style={{ height: 'auto' }}
      />
      <button
        onClick={onSend}
        disabled={!value.trim() || isLoading || disabled}
        className={cn(
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
          value.trim() && !isLoading && !disabled
            ? 'bg-[var(--color-background-primary)] text-[var(--color-on-background-primary)] hover:opacity-90'
            : 'bg-[var(--surface-border)] text-[var(--text-secondary)] cursor-not-allowed',
        )}
      >
        {isLoading ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <ArrowUpIcon className="w-4 h-4" />
        )}
      </button>
    </div>
  )
})

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-br-sm px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap bg-[var(--color-background-primary)] text-[var(--color-on-background-primary)]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-background-primary)] flex items-center justify-center mt-0.5">
        <span className="text-[var(--color-on-background-primary)] text-xs">✦</span>
      </div>
      <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap max-w-[85%] pt-1">
        {message.content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-background-primary)] flex items-center justify-center">
        <span className="text-[var(--color-on-background-primary)] text-xs">✦</span>
      </div>
      <div className="flex gap-1 items-center pt-2">
        <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}
