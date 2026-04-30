// AI Assistant — types for chat messages, tool calls, and streaming protocol.
//
// Phase 4 (UI revamp 2.0) introduces a streaming, tool-call-aware chat model.
// The `ChatMessage` type below is the canonical drawer transcript shape;
// content is a list of `ContentBlock`s (text or tool calls).
//
// The intent-driven types (PipelineIntentModel, IntentApiRequest/Response,
// `LegacyChatMessage`) are kept around because `materializeIntentToStore.ts`
// remains a useful reference implementation. They are NOT used by the new
// drawer flow.

// ─── New chat / streaming types (Phase 4) ────────────────────────────────────

export type AiRole = 'user' | 'assistant' | 'system' | 'tool'

export type ToolCallKind = 'pipeline.draft' | 'library.search' | 'validate'

export type ToolCallBlock = {
  kind: 'tool_call'
  callId: string
  tool: ToolCallKind
  status: 'pending' | 'success' | 'error'
  input: Record<string, unknown>
  output?: unknown
  errorMessage?: string
}

export type TextBlock = {
  kind: 'text'
  text: string
}

export type ContentBlock = TextBlock | ToolCallBlock

export type ChatMessage = {
  id: string
  role: AiRole
  blocks: ContentBlock[]
  createdAt: string
}

/**
 * SSE event envelope emitted by `/ui-api/ai/chat`.
 * The route streams these as `data: <json>\n\n` SSE frames.
 */
export type StreamEvent =
  | { type: 'message_start'; messageId: string }
  | { type: 'text_delta'; messageId: string; delta: string }
  | {
      type: 'tool_call_start'
      messageId: string
      callId: string
      tool: ToolCallKind
      input: Record<string, unknown>
    }
  | {
      type: 'tool_call_result'
      messageId: string
      callId: string
      output: unknown
      status: 'success' | 'error'
      errorMessage?: string
    }
  | { type: 'message_stop'; messageId: string; tokensUsed?: number }
  | { type: 'error'; message: string }

// ─── Legacy intent-driven types (kept for materialize bridge) ────────────────

/** @deprecated Drawer flow uses `ChatMessage` (above). */
export type ChatRole = 'user' | 'assistant' | 'system'

/** @deprecated Drawer flow uses `ChatMessage` (above). Used by materializeIntentToStore. */
export interface LegacyChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
}

/** AI-inferred Kafka connection intent */
export interface KafkaConnectionIntent {
  bootstrapServers?: string
  securityProtocol?: string
  authMethod?: string
  username?: string
  // password intentionally omitted — never stored in intent after validation
  connectionStatus: 'unknown' | 'valid' | 'invalid'
  connectionError?: string
  availableTopics?: string[]
}

/** AI-inferred OTLP connection intent */
export interface OtlpConnectionIntent {
  endpoint?: string
  protocol?: 'grpc' | 'http/protobuf' | 'http/json'
  /** OTLP signal type: logs, traces, or metrics */
  signalType?: 'logs' | 'traces' | 'metrics'
}

/** AI-inferred ClickHouse connection intent */
export interface ClickhouseConnectionIntent {
  host?: string
  httpPort?: number
  nativePort?: number
  username?: string
  // password intentionally omitted — never stored in intent after validation
  database?: string
  connectionStatus: 'unknown' | 'valid' | 'invalid'
  connectionError?: string
  availableTables?: string[]
  availableDatabases?: string[]
  useSSL?: boolean
  skipCertificateVerification?: boolean
}

/** AI-inferred topic intent */
export interface TopicIntent {
  topicIndex: number
  topicName?: string
  deduplicationEnabled?: boolean
  deduplicationKey?: string
  deduplicationWindow?: number
  deduplicationWindowUnit?: 'seconds' | 'minutes' | 'hours' | 'days'
}

/** AI-inferred destination (ClickHouse table) intent */
export interface DestinationIntent {
  tableName?: string
  createNewTable?: boolean
  columnMappings?: Array<{
    sourceField: string
    targetColumn: string
    targetType?: string
  }>
}

/** AI-inferred filter intent */
export interface FilterIntent {
  expression?: string
  validationStatus?: 'unknown' | 'valid' | 'invalid'
  validationError?: string
}

/**
 * The central intent model — intermediate representation between LLM and domain slices.
 * AI populates this; materializeIntentToStore() converts it to slice state.
 */
export interface PipelineIntentModel {
  /** MVP: 1 topic only (ingest-only or deduplication) */
  topicCount: 1 | 2 | null

  /**
   * Operation type:
   * - ingest-only: 1 topic, no dedup
   * - deduplication: 1 topic, with dedup
   */
  operationType: 'ingest-only' | 'deduplication' | null

  /** Source type: kafka or otlp (logs/traces/metrics) */
  sourceType?: 'kafka' | 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'

  kafka: KafkaConnectionIntent | null
  otlp: OtlpConnectionIntent | null
  clickhouse: ClickhouseConnectionIntent | null
  topics: TopicIntent[]
  destination: DestinationIntent | null
  filter: FilterIntent | null

  /**
   * Readiness mode:
   * - collecting: gathering connection info
   * - enriching: running deterministic checks (Kafka/ClickHouse)
   * - ready_for_review: intent has enough info for user to review
   * - ready_for_materialization: all required fields confirmed, can generate draft
   */
  mode: 'collecting' | 'enriching' | 'ready_for_review' | 'ready_for_materialization'

  /** Fields the LLM still needs to ask about */
  unresolvedQuestions: string[]
}

// ─── AI Session State (legacy) ───────────────────────────────────────────────

export type AiSessionStatus =
  | 'idle'
  | 'collecting'
  | 'enriching'
  | 'ready'
  | 'materializing'
  | 'error'

export interface DocHintItem {
  title: string
  url: string
  snippet?: string
}

export interface ProposedChange {
  section: string
  description: string
  accepted: boolean
}

// ─── Legacy API Request / Response types ─────────────────────────────────────

export interface IntentApiRequest {
  sessionId: string | null
  userMessage: string
  intent: PipelineIntentModel | null
  messages: LegacyChatMessage[]
  kafkaPassword?: string
  clickhousePassword?: string
}

export interface IntentApiResponse {
  intentDelta: DeepPartial<PipelineIntentModel>
  assistantMessage: string
  unresolvedQuestions: string[]
  docHints: DocHintItem[]
}

export interface GenerateApiRequest {
  sessionId: string
  intent: PipelineIntentModel
}

export interface GenerateApiResponse {
  success: boolean
  materialized: boolean
  error?: string
  stepToNavigate?: string
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
