'use client'

import React, { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useStore } from '@/src/store'
import { AiChatPanel } from '@/src/modules/ai/components/AiChatPanel'
import { AiIntentSummary } from '@/src/modules/ai/components/AiIntentSummary'
import { AiDocHints } from '@/src/modules/ai/components/AiDocHints'
import { Button } from '@/src/components/ui/button'
import { materializeIntentToStore, type MaterializationPasswords } from '@/src/modules/ai/materializeIntentToStore'
import { navigateToWizardStep } from '@/src/modules/ai/navigateToWizardStep'
import { cn } from '@/src/utils/common.client'
import type { IntentApiRequest, IntentApiResponse } from '@/src/modules/ai/types'
import type { TestConnectionResponse } from '@/src/app/ui-api/ai/pipeline/test-connection/route'

export function AiPipelinePageClient() {
  const router = useRouter()
  const { aiSessionStore } = useStore()
  const { sessionId, status, messages, intent, docHints, error, kafkaPassword, clickhousePassword } = aiSessionStore

  // Initialize session on mount if not already active
  React.useEffect(() => {
    if (status === 'idle') {
      aiSessionStore.startAiSession()
    }
  }, [status, aiSessionStore])

  const isLoading = status === 'enriching' || status === 'materializing'
  const canGenerate = intent?.mode === 'ready_for_materialization' || intent?.mode === 'ready_for_review'
  const [isTestingConnections, setIsTestingConnections] = React.useState(false)

  const handleSendMessage = useCallback(
    async (userMessage: string) => {
      if (isLoading) return

      // Add user message to chat
      aiSessionStore.appendAiMessage({ role: 'user', content: userMessage })
      aiSessionStore.setAiStatus('enriching')

      try {
        const endpoint = messages.length > 0 && intent !== null ? '/ui-api/ai/pipeline/refine' : '/ui-api/ai/pipeline/intent'

        const requestBody: IntentApiRequest = {
          sessionId,
          userMessage,
          intent,
          messages,
          kafkaPassword: kafkaPassword ?? undefined,
          clickhousePassword: clickhousePassword ?? undefined,
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`)
        }

        const data: IntentApiResponse = await response.json()

        // Apply intent delta
        if (data.intentDelta && Object.keys(data.intentDelta).length > 0) {
          aiSessionStore.applyIntentDelta(data.intentDelta)
        }

        // Set doc hints
        if (data.docHints?.length) {
          aiSessionStore.setAiDocHints(data.docHints)
        }

        // Add assistant response to chat
        aiSessionStore.appendAiMessage({
          role: 'assistant',
          content: data.assistantMessage,
        })

        aiSessionStore.setAiStatus('collecting')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        aiSessionStore.setAiError(msg)
        aiSessionStore.appendAiMessage({
          role: 'assistant',
          content: `Sorry, I encountered an error: ${msg}. Please try again.`,
        })
      }
    },
    [sessionId, intent, messages, isLoading, aiSessionStore, kafkaPassword, clickhousePassword],
  )

  const handleTestConnections = useCallback(async () => {
    if (!intent || isTestingConnections) return
    setIsTestingConnections(true)
    try {
      const response = await fetch('/ui-api/ai/pipeline/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          kafkaPassword: kafkaPassword ?? undefined,
          clickhousePassword: clickhousePassword ?? undefined,
        }),
      })
      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`)
      }
      const data: TestConnectionResponse = await response.json()

      if (data.intentDelta && Object.keys(data.intentDelta).length > 0) {
        aiSessionStore.applyIntentDelta(data.intentDelta)
      }

      // Summarize results as an assistant message so context is preserved in chat
      const lines: string[] = []
      if (data.summary.kafka) lines.push(data.summary.kafka)
      if (data.summary.clickhouse) lines.push(data.summary.clickhouse)
      if (lines.length > 0) {
        aiSessionStore.appendAiMessage({ role: 'assistant', content: lines.join('\n') })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection test failed'
      aiSessionStore.appendAiMessage({ role: 'assistant', content: `Connection test error: ${msg}` })
    } finally {
      setIsTestingConnections(false)
    }
  }, [intent, kafkaPassword, clickhousePassword, aiSessionStore, isTestingConnections])

  const handleGenerateDraft = useCallback(async () => {
    if (!intent) return

    aiSessionStore.setAiStatus('materializing')

    try {
      // 1. Validate intent on server
      const validateResponse = await fetch('/ui-api/ai/pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, intent }),
      })

      const validateData = await validateResponse.json()

      if (!validateData.success) {
        aiSessionStore.appendAiMessage({
          role: 'assistant',
          content: `I can't generate the draft yet: ${validateData.error}. Let's fill in the missing details.`,
        })
        aiSessionStore.setAiStatus('collecting')
        return
      }

      // 2. Materialize intent to store (client-side hydration)
      const matPasswords: MaterializationPasswords = {
        kafkaPassword: kafkaPassword ?? undefined,
        clickhousePassword: clickhousePassword ?? undefined,
      }
      const result = await materializeIntentToStore(intent, matPasswords)

      if (!result.success) {
        aiSessionStore.appendAiMessage({
          role: 'assistant',
          content: `Some sections couldn't be pre-filled: ${result.errors.map((e) => e.section).join(', ')}. You'll need to fill those in manually.`,
        })
      }

      // 3. Set wizard navigation state
      navigateToWizardStep(intent)

      // 4. Navigate to wizard
      router.push('/pipelines/create')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Materialization failed'
      aiSessionStore.setAiError(msg)
      aiSessionStore.setAiStatus('error')
    }
  }, [sessionId, intent, router, aiSessionStore])

  return (
    // Negative margins cancel main's py-4/sm:py-8 + footer py-4/sm:py-6 so the panel fills the screen without body scroll
    <div className="-mt-4 sm:-mt-8 -mb-12 sm:-mb-20 h-[calc(100dvh-56px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--surface-border)] shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="w-px h-4 bg-[var(--surface-border)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Create with AI</span>
        </div>
        {error && (
          <span className="text-xs text-[var(--color-foreground-critical)]">{error}</span>
        )}
      </div>

      {/* Main two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Chat panel (left) */}
        <div className="flex flex-col w-[55%] border-r border-[var(--surface-border)] min-h-0">
          <AiChatPanel
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            placeholder="Describe your pipeline — e.g. 'Stream orders from Kafka to ClickHouse with deduplication by order_id'"
            disabled={status === 'materializing'}
          />
          {/* Doc hints at bottom of chat panel */}
          <AiDocHints hints={docHints} />
        </div>

        {/* Intent summary (right) */}
        <div className="flex flex-col w-[45%] min-h-0">
          <AiIntentSummary
            intent={intent}
            className="flex-1 min-h-0"
            kafkaPassword={kafkaPassword ?? undefined}
            clickhousePassword={clickhousePassword ?? undefined}
            onKafkaPasswordChange={aiSessionStore.setKafkaPassword}
            onClickhousePasswordChange={aiSessionStore.setClickhousePassword}
            onTestConnections={handleTestConnections}
            isTestingConnections={isTestingConnections}
          />

          {/* Generate Draft CTA */}
          <div className={cn(
            'p-4 border-t border-[var(--surface-border)] shrink-0 transition-opacity',
            canGenerate ? 'opacity-100' : 'opacity-40 pointer-events-none',
          )}>
            <Button
              variant="primary"
              className="w-full"
              onClick={handleGenerateDraft}
              disabled={!canGenerate || status === 'materializing'}
              loading={status === 'materializing'}
              loadingText="Generating draft..."
            >
              Generate Draft
            </Button>
            <p className="text-xs text-[var(--text-secondary)] text-center mt-2">
              {canGenerate
                ? "Pre-fills the wizard with your pipeline configuration"
                : "Keep chatting to complete your pipeline configuration"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
