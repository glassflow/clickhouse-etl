// Drawer body + footer — owns transcript hydration/persistence and the
// SSE streaming send loop. Per-scope transcripts are keyed by `scopeKey`.

'use client'

import * as React from 'react'
import { DrawerBody, DrawerFooter } from '@/src/components/ui/drawer'
import { Button } from '@/src/components/ui/button'
import { Textarea } from '@/src/components/ui/textarea'
import { useStore } from '@/src/store'
import { scopeKey } from '@/src/store/ai-ui.store'
import type { ChatMessage, ToolCallBlock } from '@/src/modules/ai/types'
import { consumeStream } from '@/src/modules/ai/streaming'
import { AiMessage } from './AiMessage'
import { SuggestionChips } from './SuggestionChips'
import { SendIcon } from 'lucide-react'

export function AiChatPanel() {
  const { aiUiStore } = useStore()
  const [draft, setDraft] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const key = scopeKey(aiUiStore.scope)
  const messages = aiUiStore.transcripts[key] ?? []

  // Hydrate from server when scope changes. Triggers once per scope mount.
  React.useEffect(() => {
    let cancelled = false
    fetch(`/ui-api/ai/chats/${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.messages)) {
          aiUiStore.setTranscript(key, data.messages as ChatMessage[])
        }
      })
      .catch(() => {
        /* ignore network errors — drawer renders empty state */
      })
    return () => {
      cancelled = true
    }
    // aiUiStore is stable from zustand; depending on key alone is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Persist on transcript change (debounced 500ms).
  React.useEffect(() => {
    if (messages.length === 0) return
    const t = setTimeout(() => {
      fetch(`/ui-api/ai/chats/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages,
          modelId: aiUiStore.modelId,
          tokensUsed: aiUiStore.tokensUsedThisSession,
        }),
      }).catch(() => {})
    }, 500)
    return () => clearTimeout(t)
  }, [messages, key, aiUiStore.modelId, aiUiStore.tokensUsedThisSession])

  // Auto-scroll to bottom on every new message.
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || aiUiStore.streaming) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      blocks: [{ kind: 'text', text: trimmed }],
      createdAt: new Date().toISOString(),
    }
    aiUiStore.appendMessage(key, userMsg)
    setDraft('')

    // Pre-create empty assistant message so the streaming text deltas have
    // something to patch into.
    const assistantMsgId = `a-${Date.now()}`
    aiUiStore.appendMessage(key, {
      id: assistantMsgId,
      role: 'assistant',
      blocks: [{ kind: 'text', text: '' }],
      createdAt: new Date().toISOString(),
    })
    aiUiStore.setStreaming(true)

    try {
      const res = await fetch('/ui-api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pipelineId:
            aiUiStore.scope.kind === 'pipeline' ? aiUiStore.scope.pipelineId : null,
          messages: [...messages, userMsg],
          modelId: aiUiStore.modelId,
        }),
      })

      for await (const event of consumeStream(res)) {
        if (event.type === 'text_delta') {
          aiUiStore.patchLastAssistant(key, (m) => {
            const last = m.blocks[m.blocks.length - 1]
            if (last?.kind === 'text') {
              return {
                ...m,
                blocks: [...m.blocks.slice(0, -1), { ...last, text: last.text + event.delta }],
              }
            }
            return {
              ...m,
              blocks: [...m.blocks, { kind: 'text', text: event.delta }],
            }
          })
        }
        if (event.type === 'tool_call_start') {
          const block: ToolCallBlock = {
            kind: 'tool_call',
            callId: event.callId,
            tool: event.tool,
            status: 'pending',
            input: event.input,
          }
          aiUiStore.patchLastAssistant(key, (m) => ({
            ...m,
            blocks: [...m.blocks, block],
          }))
        }
        if (event.type === 'tool_call_result') {
          aiUiStore.patchLastAssistant(key, (m) => ({
            ...m,
            blocks: m.blocks.map((b) =>
              b.kind === 'tool_call' && b.callId === event.callId
                ? {
                    ...b,
                    status: event.status,
                    output: event.output,
                    errorMessage: event.errorMessage,
                  }
                : b,
            ),
          }))
        }
        if (event.type === 'message_stop' && event.tokensUsed) {
          aiUiStore.setTokensUsed(aiUiStore.tokensUsedThisSession + event.tokensUsed)
        }
        if (event.type === 'error') {
          aiUiStore.patchLastAssistant(key, (m) => ({
            ...m,
            blocks: [
              ...m.blocks,
              { kind: 'text', text: `\n\n_Error: ${event.message}_` },
            ],
          }))
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'request failed'
      aiUiStore.patchLastAssistant(key, (m) => ({
        ...m,
        blocks: [...m.blocks, { kind: 'text', text: `\n\n_Error: ${message}_` }],
      }))
    } finally {
      aiUiStore.setStreaming(false)
    }
  }

  return (
    <>
      <DrawerBody className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 mt-6">
            <p className="title-6 text-[var(--text-primary)]">How can I help?</p>
            <p className="body-3 text-[var(--text-secondary)]">
              Ask me to build a pipeline, find a schema, or validate a graph.
            </p>
            <SuggestionChips onPick={(t) => setDraft(t)} />
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <AiMessage key={m.id} message={m} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </DrawerBody>
      <DrawerFooter className="flex-col gap-2 items-stretch">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask anything…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send(draft)
            }
          }}
          disabled={aiUiStore.streaming}
        />
        <div className="flex items-center justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => send(draft)}
            disabled={!draft.trim() || aiUiStore.streaming}
            loading={aiUiStore.streaming}
            loadingText="Streaming…"
          >
            <SendIcon size={12} className="mr-1.5" />
            Send
          </Button>
        </div>
      </DrawerFooter>
    </>
  )
}
