'use client'

import React, { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { History, MoreHorizontal } from 'lucide-react'
import { useStore } from '@/src/store'
import { AiChatPanel } from '@/src/modules/ai/components/AiChatPanel'
import { AiIntentSummary } from '@/src/modules/ai/components/AiIntentSummary'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { materializeIntentToStore, type MaterializationPasswords } from '@/src/modules/ai/materializeIntentToStore'
import { navigateToWizardStep } from '@/src/modules/ai/navigateToWizardStep'
import { cn } from '@/src/utils/common.client'
import type { IntentApiRequest, IntentApiResponse } from '@/src/modules/ai/types'
import type { TestConnectionResponse } from '@/src/app/ui-api/ai/pipeline/test-connection/route'
import type { DocHintItem } from '@/src/modules/ai/types'

export function AiPipelinePageClient() {
  const router = useRouter()
  const { aiSessionStore } = useStore()
  const { sessionId, status, messages, intent, docHints, error, kafkaPassword, clickhousePassword } = aiSessionStore

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

        if (!response.ok) throw new Error(`Request failed: ${response.statusText}`)

        const data: IntentApiResponse = await response.json()

        if (data.intentDelta && Object.keys(data.intentDelta).length > 0) {
          aiSessionStore.applyIntentDelta(data.intentDelta)
        }
        if (data.docHints?.length) {
          aiSessionStore.setAiDocHints(data.docHints)
        }

        aiSessionStore.appendAiMessage({ role: 'assistant', content: data.assistantMessage })
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
      if (!response.ok) throw new Error(`Request failed: ${response.statusText}`)
      const data: TestConnectionResponse = await response.json()

      if (data.intentDelta && Object.keys(data.intentDelta).length > 0) {
        aiSessionStore.applyIntentDelta(data.intentDelta)
      }

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

      navigateToWizardStep(intent)
      router.push('/pipelines/create')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Materialization failed'
      aiSessionStore.setAiError(msg)
      aiSessionStore.setAiStatus('error')
    }
  }, [sessionId, intent, router, aiSessionStore])

  const statusLabel: Record<string, string> = {
    idle: 'Initializing',
    collecting: 'Collecting info',
    enriching: 'Processing',
    materializing: 'Generating',
    error: 'Error',
  }

  return (
    // Negative margins cancel main's py-4/sm:py-8 and footer py-4/sm:py-6 so the panel fills screen height
    <div className="-mt-4 sm:-mt-8 -mb-12 sm:-mb-20 h-[calc(100dvh-56px)] flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between pt-6 pb-4 shrink-0">
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
          Playground
        </h1>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--surface-border)] rounded-lg px-3 h-8 shadow-sm bg-[var(--surface-bg)]"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to pipelines
        </button>
      </div>

      {/* Playground card — grows to fill remaining height */}
      <div className="flex-1 min-h-0 border border-[var(--surface-border)] rounded-xl bg-[var(--surface-bg)] flex flex-col mb-8">
        {/* Card header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-[var(--surface-border)] shrink-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] truncate">
            AI Pipeline Builder
          </h2>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-[var(--color-foreground-critical)] mr-2 shrink-0">{error}</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => aiSessionStore.startAiSession()}
            >
              Reset
            </Button>
            <Button variant="secondary" size="icon" className="h-9 w-9">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Card body — fills remaining card height */}
        <div className="flex-1 min-h-0 flex gap-6 px-8 py-6">
          {/* Main content area */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-4">
            {/* Two panels — fill available height */}
            <div className="flex-1 min-h-0 flex gap-6">
              {/* Chat panel */}
              <div className="flex-1 overflow-hidden">
                <AiChatPanel
                  messages={messages}
                  isLoading={isLoading}
                  onSendMessage={handleSendMessage}
                  placeholder="Describe your pipeline — e.g. 'Stream orders from Kafka to ClickHouse with deduplication by order_id'"
                  disabled={status === 'materializing'}
                />
              </div>

              {/* Pipeline preview panel */}
              <div className="flex-1 border border-[var(--surface-border)] rounded-xl shadow-sm bg-[var(--surface-bg-sunken)] overflow-hidden">
                <AiIntentSummary
                  intent={intent}
                  className="h-full"
                  kafkaPassword={kafkaPassword ?? undefined}
                  clickhousePassword={clickhousePassword ?? undefined}
                  onKafkaPasswordChange={aiSessionStore.setKafkaPassword}
                  onClickhousePasswordChange={aiSessionStore.setClickhousePassword}
                  onTestConnections={handleTestConnections}
                  isTestingConnections={isTestingConnections}
                />
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="shrink-0 flex gap-2 items-center">
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateDraft}
                disabled={!canGenerate || status === 'materializing'}
                loading={status === 'materializing'}
                loadingText="Generating draft..."
                className={cn(!canGenerate && 'opacity-40 pointer-events-none')}
              >
                Generate Draft
              </Button>
              <Button
                variant="tertiary"
                size="icon"
                className="h-9 w-10"
                title="Reset conversation"
                disabled={messages.length === 0}
                onClick={() => aiSessionStore.startAiSession()}
              >
                <History className="w-4 h-4" />
              </Button>
              {!canGenerate && intent && (
                <span className="text-xs text-[var(--text-secondary)] ml-1">
                  Keep chatting to complete your pipeline configuration
                </span>
              )}
            </div>
          </div>

          {/* Settings sidebar */}
          <div className="w-[200px] flex flex-col gap-6 shrink-0 overflow-y-auto">
            {/* Status */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">Status</p>
              <Badge
                variant={
                  status === 'error'
                    ? 'destructive'
                    : intent?.mode === 'ready_for_materialization'
                      ? 'default'
                      : 'secondary'
                }
                className="text-xs w-fit"
              >
                {statusLabel[status] ?? status}
              </Badge>
            </div>

            {/* Model */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">Model</p>
              <div className="border border-[var(--surface-border)] rounded-lg px-3 h-9 flex items-center justify-between bg-[var(--surface-bg)] shadow-sm opacity-60">
                <span className="text-sm text-[var(--text-primary)] truncate">claude-sonnet-4-6</span>
              </div>
            </div>

            {/* Tips */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">Tips</p>
              <ul className="space-y-2">
                <li className="text-xs text-[var(--text-secondary)]">· Kafka brokers, topic, auth method</li>
                <li className="text-xs text-[var(--text-secondary)]">· ClickHouse host, port, database</li>
                <li className="text-xs text-[var(--text-secondary)]">· Deduplication key if needed</li>
              </ul>
            </div>

            {/* Doc hints */}
            {docHints.length > 0 && (
              <DocHints hints={docHints} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DocHints({ hints }: { hints: DocHintItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-[var(--text-primary)]">Docs</p>
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
