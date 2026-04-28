'use client'

import React, { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { Layers, Wand2 } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { materializeIntentToStore, type MaterializationPasswords } from '@/src/modules/ai/materializeIntentToStore'
import type { PipelineIntentModel, ChatMessage, IntentApiRequest, IntentApiResponse, DeepPartial } from '@/src/modules/ai/types'

// ─── Session state ────────────────────────────────────────────────────────────

type SessionStatus = 'idle' | 'collecting' | 'enriching' | 'materializing' | 'error'

interface SessionState {
  status: SessionStatus
  messages: ChatMessage[]
  intent: PipelineIntentModel | null
  error: string | null
  kafkaPassword: string | null
  clickhousePassword: string | null
}

const initialSession: SessionState = {
  status: 'idle',
  messages: [],
  intent: null,
  error: null,
  kafkaPassword: null,
  clickhousePassword: null,
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function CreatePipelineWithAiPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionState>(initialSession)
  const [inputValue, setInputValue] = useState('')

  const { status, messages, intent, error } = session

  const isLoading = status === 'enriching' || status === 'materializing'

  // A pipeline is ready to materialise when the intent has reached a confirmed mode
  const canGenerate =
    intent?.mode === 'ready_for_materialization' || intent?.mode === 'ready_for_review'

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSendMessage = useCallback(
    async (userMessage: string) => {
      if (isLoading || !userMessage.trim()) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      }

      setSession((prev) => ({
        ...prev,
        status: 'enriching',
        messages: [...prev.messages, userMsg],
      }))

      try {
        const endpoint =
          messages.length > 0 && intent !== null
            ? '/ui-api/ai/pipeline/refine'
            : '/ui-api/ai/pipeline/intent'

        const requestBody: IntentApiRequest = {
          sessionId: null,
          userMessage,
          intent,
          messages,
          kafkaPassword: session.kafkaPassword ?? undefined,
          clickhousePassword: session.clickhousePassword ?? undefined,
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) throw new Error(`Request failed: ${response.statusText}`)

        const data: IntentApiResponse = await response.json()

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.assistantMessage,
          timestamp: Date.now(),
        }

        setSession((prev) => ({
          ...prev,
          status: 'collecting',
          messages: [...prev.messages, assistantMsg],
          intent:
            data.intentDelta && Object.keys(data.intentDelta).length > 0
              ? mergeIntentDelta(prev.intent, data.intentDelta)
              : prev.intent,
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${msg}. Please try again.`,
          timestamp: Date.now(),
        }
        setSession((prev) => ({
          ...prev,
          status: 'error',
          error: msg,
          messages: [...prev.messages, errMsg],
        }))
      }
    },
    [isLoading, messages, intent, session.kafkaPassword, session.clickhousePassword],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage(inputValue)
        setInputValue('')
      }
    },
    [handleSendMessage, inputValue],
  )

  // ── Continue in Wizard ─────────────────────────────────────────────────────

  const handleContinueInWizard = useCallback(async () => {
    if (!intent) return
    setSession((prev) => ({ ...prev, status: 'materializing' }))
    try {
      const passwords: MaterializationPasswords = {
        kafkaPassword: session.kafkaPassword ?? undefined,
        clickhousePassword: session.clickhousePassword ?? undefined,
      }
      await materializeIntentToStore(intent, passwords, 'wizard')
      router.push('/pipelines/create')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Materialization failed'
      setSession((prev) => ({ ...prev, status: 'error', error: msg }))
    }
  }, [intent, session.kafkaPassword, session.clickhousePassword, router])

  // ── Open in Canvas ─────────────────────────────────────────────────────────

  const handleOpenInCanvas = useCallback(async () => {
    if (!intent) return
    setSession((prev) => ({ ...prev, status: 'materializing' }))
    try {
      await materializeIntentToStore(intent, undefined, 'canvas')
      router.push('/canvas')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Canvas initialization failed'
      setSession((prev) => ({ ...prev, status: 'error', error: msg }))
    }
  }, [intent, router])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="-mt-4 sm:-mt-8 -mb-12 sm:-mb-20 h-[calc(100dvh-56px)] flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between pt-6 pb-4 shrink-0">
        <h1 className="title-2 text-[var(--text-primary)]">AI Pipeline Builder</h1>
        <Button variant="outline" size="sm" onClick={() => router.push('/')}>
          <ChevronLeftIcon className="w-4 h-4 mr-1" />
          Back to pipelines
        </Button>
      </div>

      {/* Main card */}
      <div className="flex-1 min-h-0 border border-[var(--surface-border)] rounded-xl bg-[var(--surface-bg)] flex flex-col mb-8">
        {/* Card header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-[var(--surface-border)] shrink-0">
          <p className="body-2 text-[var(--text-primary)] font-semibold">Describe your pipeline</p>
          {error && (
            <span className="caption-1 text-[var(--color-foreground-critical)]">{error}</span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSession(initialSession)}
          >
            Reset
          </Button>
        </div>

        {/* Chat area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="body-3 text-[var(--text-secondary)] text-center mt-12">
              Tell me about the pipeline you want to create — Kafka brokers, topic, ClickHouse destination.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-xl px-4 py-2.5 body-3 ${
                  msg.role === 'user'
                    ? 'bg-[var(--surface-bg-raised)] text-[var(--text-primary)]'
                    : 'bg-[var(--surface-bg-sunken)] text-[var(--text-secondary)] border border-[var(--surface-border)]'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-2.5 bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
                <span className="caption-1 text-[var(--text-secondary)]">Thinking…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input + action bar */}
        <div className="shrink-0 px-8 py-4 border-t border-[var(--surface-border)] flex flex-col gap-3">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your pipeline — e.g. 'Stream orders from Kafka to ClickHouse with deduplication by order_id'"
            rows={2}
            disabled={isLoading}
            className="w-full resize-none rounded-lg px-4 py-3 body-3 bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)] text-[var(--text-primary)] placeholder:text-[var(--control-fg-placeholder)] focus:outline-none focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)] transition-colors disabled:opacity-50"
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                handleSendMessage(inputValue)
                setInputValue('')
              }}
              disabled={isLoading || !inputValue.trim()}
              loading={status === 'enriching'}
              loadingText="Processing…"
            >
              Send
            </Button>

            <div className="flex-1" />

            {/* Continue in Wizard — only visible when intent is ready */}
            {canGenerate && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleContinueInWizard}
                disabled={status === 'materializing'}
                loading={status === 'materializing'}
                loadingText="Opening wizard…"
              >
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                Continue in Wizard
              </Button>
            )}

            {/* Open in Canvas — only visible when intent is ready */}
            {canGenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInCanvas}
                loading={status === 'materializing'}
                loadingText="Opening canvas…"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                Open in Canvas
              </Button>
            )}

            {!canGenerate && intent && (
              <span className="caption-1 text-[var(--text-secondary)]">
                Keep chatting to complete your pipeline configuration
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeIntentDelta(
  base: PipelineIntentModel | null,
  delta: DeepPartial<PipelineIntentModel>,
): PipelineIntentModel {
  if (!base) {
    return delta as PipelineIntentModel
  }
  return { ...base, ...delta } as PipelineIntentModel
}
