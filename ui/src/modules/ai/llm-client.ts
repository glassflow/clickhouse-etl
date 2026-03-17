/**
 * LLM Client — provider-agnostic adapter for AI intent synthesis.
 *
 * Provider selection (server-side env vars only — never NEXT_PUBLIC_*):
 *   LLM_PROVIDER=openai        → uses OPENAI_API_KEY  (default)
 *   LLM_PROVIDER=anthropic     → uses ANTHROPIC_API_KEY
 *
 * Model override (optional):
 *   OPENAI_MODEL=gpt-4o        (default: gpt-4o)
 *   ANTHROPIC_MODEL=claude-sonnet-4-6  (default: claude-sonnet-4-6)
 *
 * This module runs SERVER-SIDE ONLY (in Next.js API routes).
 * Never import this from browser-side code.
 */

import { SYSTEM_PROMPT, INTENT_EXTRACTION_PROMPT } from './prompts/system-prompt'
import { redactKafkaCredentials } from './enrichers/kafkaEnricher'
import { redactClickhouseCredentials } from './enrichers/clickhouseEnricher'
import { structuredLogger } from '@/src/observability'
import type { ChatMessage, PipelineIntentModel, DeepPartial, DocHintItem } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LlmChatParams {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
}

export interface LlmChatResponse {
  content: string
}

interface LlmIntentRequest {
  userMessage: string
  intent: PipelineIntentModel | null
  messages: ChatMessage[]
  kafkaEnrichment: { connectionStatus: 'unknown' | 'valid' | 'invalid'; availableTopics?: string[]; error?: string }
  clickhouseEnrichment: { connectionStatus: 'unknown' | 'valid' | 'invalid'; availableTables?: string[]; error?: string }
}

export interface LlmIntentResult {
  assistantMessage: string
  intentDelta: DeepPartial<PipelineIntentModel>
  unresolvedQuestions: string[]
  docHints: DocHintItem[]
}

// ─── Provider interface ───────────────────────────────────────────────────────

interface LlmProvider {
  chat(params: LlmChatParams): Promise<LlmChatResponse>
}

// ─── Anthropic provider ───────────────────────────────────────────────────────

async function createAnthropicProvider(): Promise<LlmProvider> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  return {
    async chat(params: LlmChatParams): Promise<LlmChatResponse> {
      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: params.maxTokens || 1024,
        system: params.systemPrompt,
        messages: params.messages,
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected LLM response type')
      }
      return { content: content.text }
    },
  }
}

// ─── OpenAI provider ─────────────────────────────────────────────────────────

async function createOpenAIProvider(): Promise<LlmProvider> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  return {
    async chat(params: LlmChatParams): Promise<LlmChatResponse> {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        max_tokens: params.maxTokens || 1024,
        messages: [
          { role: 'system', content: params.systemPrompt },
          ...params.messages,
        ],
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty LLM response')
      }
      return { content }
    },
  }
}

// ─── Provider factory ─────────────────────────────────────────────────────────

async function getProvider(): Promise<LlmProvider> {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()

  if (provider === 'anthropic') {
    return createAnthropicProvider()
  }
  return createOpenAIProvider()
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Calls the LLM to produce an assistant message and intent delta.
 * Handles prompt construction, credential redaction, and response parsing.
 */
export async function buildLlmIntentResponse(req: LlmIntentRequest): Promise<LlmIntentResult> {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()
  const apiKeyPresent = provider === 'anthropic'
    ? !!process.env.ANTHROPIC_API_KEY
    : !!process.env.OPENAI_API_KEY

  if (!apiKeyPresent) {
    // Fallback: no LLM configured — return a helpful message
    return buildFallbackResponse(req)
  }

  try {
    const provider = await getProvider()

    // Build conversation messages for LLM
    const conversationMessages = buildConversationMessages(req)

    // Step 1: Get assistant response (conversational)
    const chatResponse = await provider.chat({
      systemPrompt: SYSTEM_PROMPT,
      messages: conversationMessages,
      maxTokens: 512,
    })

    const assistantMessage = chatResponse.content

    // Step 2: Extract structured intent delta
    const intentDelta = await extractIntentDelta(provider, req, assistantMessage)

    // Determine unresolved questions from intent
    const unresolvedQuestions = (intentDelta.unresolvedQuestions || []).filter((q): q is string => !!q)

    return {
      assistantMessage,
      intentDelta,
      unresolvedQuestions,
      docHints: buildDocHints(req.intent, intentDelta),
    }
  } catch (error) {
    structuredLogger.error('LLM call failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Return graceful fallback on LLM failure
    return {
      assistantMessage: "I'm having trouble processing your request right now. Please try again in a moment.",
      intentDelta: {},
      unresolvedQuestions: [],
      docHints: [],
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildConversationMessages(req: LlmIntentRequest): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  // Add context about what we know so far
  if (req.intent) {
    const contextMessage = buildContextMessage(req)
    if (contextMessage) {
      messages.push({ role: 'user', content: contextMessage })
      messages.push({ role: 'assistant', content: 'I understand the current pipeline configuration context.' })
    }
  }

  // Add conversation history (last 10 messages to keep prompt size reasonable)
  const historyMessages = req.messages.slice(-10)
  for (const msg of historyMessages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // Add the current user message
  messages.push({ role: 'user', content: req.userMessage })

  return messages
}

function buildContextMessage(req: LlmIntentRequest): string {
  const parts: string[] = []

  if (req.intent?.kafka) {
    const redacted = redactKafkaCredentials(req.intent.kafka)
    parts.push(`Kafka: ${JSON.stringify(redacted)}`)
  }
  if (req.kafkaEnrichment.connectionStatus === 'valid' && req.kafkaEnrichment.availableTopics?.length) {
    parts.push(`Available Kafka topics: ${req.kafkaEnrichment.availableTopics.slice(0, 20).join(', ')}`)
  }
  if (req.kafkaEnrichment.connectionStatus === 'invalid') {
    parts.push(`Kafka connection error: ${req.kafkaEnrichment.error}`)
  }
  if (req.intent?.clickhouse) {
    const redacted = redactClickhouseCredentials(req.intent.clickhouse)
    parts.push(`ClickHouse: ${JSON.stringify(redacted)}`)
  }
  if (req.clickhouseEnrichment.connectionStatus === 'valid' && req.clickhouseEnrichment.availableTables?.length) {
    parts.push(`Available ClickHouse tables: ${req.clickhouseEnrichment.availableTables.slice(0, 30).join(', ')}`)
  }
  if (req.intent?.operationType) {
    parts.push(`Operation type: ${req.intent.operationType}`)
  }
  if (req.intent?.topics?.[0]?.topicName) {
    parts.push(`Selected topic: ${req.intent.topics[0].topicName}`)
  }

  if (parts.length === 0) return ''
  return `Current pipeline configuration context:\n${parts.join('\n')}`
}

async function extractIntentDelta(
  provider: LlmProvider,
  req: LlmIntentRequest,
  assistantMessage: string,
): Promise<DeepPartial<PipelineIntentModel>> {
  try {
    const extractionMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      {
        role: 'user',
        content: `${buildContextMessage(req)}\n\nUser said: "${req.userMessage}"\n\nYour response: "${assistantMessage}"\n\nNow extract the updated pipeline intent as JSON.`,
      },
    ]

    const response = await provider.chat({
      systemPrompt: INTENT_EXTRACTION_PROMPT,
      messages: extractionMessages,
      maxTokens: 1024,
    })

    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return {}

    const parsed = JSON.parse(jsonMatch[0])
    return parsed
  } catch (error) {
    structuredLogger.warn('Intent extraction failed, returning empty delta', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {}
  }
}

function buildDocHints(
  intent: PipelineIntentModel | null,
  delta: DeepPartial<PipelineIntentModel>,
): DocHintItem[] {
  const hints: DocHintItem[] = []

  const opType = delta.operationType || intent?.operationType
  if (opType === 'deduplication') {
    hints.push({
      title: 'Deduplication configuration',
      url: 'https://docs.glassflow.dev/docs/deduplication',
      snippet: 'Configure a unique key and time window for event deduplication',
    })
  }

  if (delta.kafka || intent?.kafka) {
    hints.push({
      title: 'Kafka connection setup',
      url: 'https://docs.glassflow.dev/docs/kafka-connection',
    })
  }

  return hints
}

function buildFallbackResponse(req: LlmIntentRequest): LlmIntentResult {
  const msg = req.userMessage.toLowerCase()
  let assistantMessage = "I can help you create a pipeline. Tell me about your Kafka and ClickHouse setup."
  const intentDelta: DeepPartial<PipelineIntentModel> = {}

  if (msg.includes('dedup') || msg.includes('duplicate')) {
    assistantMessage = "Got it — you want to deduplicate events. I'll set up a deduplication pipeline. What Kafka topic should I connect to?"
    intentDelta.operationType = 'deduplication'
    intentDelta.topicCount = 1
  } else if (msg.includes('ingest') || msg.includes('stream') || msg.includes('kafka')) {
    assistantMessage = "Let's set up an ingest pipeline. What are your Kafka bootstrap server addresses?"
    intentDelta.operationType = 'ingest-only'
    intentDelta.topicCount = 1
  }

  return {
    assistantMessage,
    intentDelta,
    unresolvedQuestions: [],
    docHints: [],
  }
}
