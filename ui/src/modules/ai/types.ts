// AI-Assisted Pipeline Creation — Core Types
// These types define the intermediate representation between LLM output and domain stores.

// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
}

// ─── Intent Model ────────────────────────────────────────────────────────────

/** AI-inferred Kafka connection intent */
export interface KafkaConnectionIntent {
  bootstrapServers?: string
  securityProtocol?: string
  authMethod?: string
  username?: string
  // password intentionally omitted — never stored in intent after validation
  connectionStatus: 'unknown' | 'valid' | 'invalid'
  /** Last connection error message, set when connectionStatus === 'invalid' */
  connectionError?: string
  availableTopics?: string[]
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
  /** Last connection error message, set when connectionStatus === 'invalid' */
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

  kafka: KafkaConnectionIntent | null
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

// ─── AI Session State ─────────────────────────────────────────────────────────

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

// ─── API Request / Response types ─────────────────────────────────────────────

export interface IntentApiRequest {
  sessionId: string | null
  userMessage: string
  intent: PipelineIntentModel | null
  messages: ChatMessage[]
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
