// Mock seed data for the Library module.
// Field names match Drizzle's $inferSelect camelCase output — consumed directly
// by useLibraryConnections / useLibraryDetail hooks as TypeScript types.

import type { SchemaField } from '@/src/lib/db/schema'
import type { KafkaConfig } from '@/src/lib/kafka-client-interface'
import type { ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'

// ─── Folders ─────────────────────────────────────────────────────────────────

export interface MockFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
}

export const mockFolders: MockFolder[] = [
  {
    id: 'folder-001',
    name: 'Analytics',
    parentId: null,
    createdAt: '2024-01-05T09:00:00Z',
  },
  {
    id: 'folder-002',
    name: 'Infrastructure',
    parentId: null,
    createdAt: '2024-01-06T10:00:00Z',
  },
]

// ─── Kafka connections ────────────────────────────────────────────────────────

export interface MockKafkaConnection {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  config: KafkaConfig
  createdAt: string
  updatedAt: string
}

export const mockKafkaConnections: MockKafkaConnection[] = [
  {
    id: 'kafka-001',
    name: 'Local Kafka',
    description: 'Single-node Kafka for local development',
    folderId: 'folder-002',
    tags: ['local', 'dev'],
    config: {
      brokers: ['localhost:9092'],
      skip_auth: true,
      protocol: 'PLAINTEXT',
      mechanism: 'NO_AUTH',
      username: '',
      password: '',
      root_ca: '',
    } as KafkaConfig,
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z',
  },
  {
    id: 'kafka-002',
    name: 'Production Kafka (Aiven)',
    description: 'Managed Kafka cluster — EU-WEST-1',
    folderId: 'folder-002',
    tags: ['production', 'aiven'],
    config: {
      brokers: ['kafka-prod.aiven.io:26448'],
      skip_auth: false,
      protocol: 'SASL_SSL',
      mechanism: 'SCRAM-SHA-256',
      username: 'avnadmin',
      password: '***redacted***',
      root_ca: '-----BEGIN CERTIFICATE-----\nMIIE...\n-----END CERTIFICATE-----',
    } as KafkaConfig,
    createdAt: '2024-01-11T11:30:00Z',
    updatedAt: '2024-02-01T08:15:00Z',
  },
  {
    id: 'kafka-003',
    name: 'Staging Confluent',
    description: 'Confluent Cloud staging environment',
    folderId: null,
    tags: ['staging', 'confluent'],
    config: {
      brokers: ['pkc-staging.confluent.io:9092'],
      skip_auth: false,
      protocol: 'SASL_SSL',
      mechanism: 'PLAIN',
      username: 'staging-api-key',
      password: '***redacted***',
      root_ca: '',
    } as KafkaConfig,
    createdAt: '2024-01-15T14:00:00Z',
    updatedAt: '2024-01-15T14:00:00Z',
  },
]

// ─── ClickHouse connections ───────────────────────────────────────────────────

export interface MockClickhouseConnection {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  config: ClickHouseConfig
  createdAt: string
  updatedAt: string
}

export const mockClickhouseConnections: MockClickhouseConnection[] = [
  {
    id: 'ch-001',
    name: 'Local ClickHouse',
    description: 'Single-node ClickHouse for local development',
    folderId: 'folder-002',
    tags: ['local', 'dev'],
    config: {
      host: 'localhost',
      httpPort: '8123',
      nativePort: '9000',
      database: 'default',
      username: 'default',
      password: '',
      secure: false,
      skipCertificateVerification: false,
    } as unknown as ClickHouseConfig,
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z',
  },
  {
    id: 'ch-002',
    name: 'Production ClickHouse Cloud',
    description: 'ClickHouse Cloud — analytics cluster (EU)',
    folderId: 'folder-002',
    tags: ['production', 'cloud'],
    config: {
      host: 'abc123.eu-west-1.aws.clickhouse.cloud',
      httpPort: '8443',
      nativePort: '9440',
      database: 'analytics',
      username: 'default',
      password: '***redacted***',
      secure: true,
      skipCertificateVerification: false,
    } as unknown as ClickHouseConfig,
    createdAt: '2024-01-12T10:00:00Z',
    updatedAt: '2024-02-05T16:00:00Z',
  },
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

export interface MockSchema {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  source: string
  registryUrl: string | null
  fields: SchemaField[]
  fieldCount: number
  pipelineCount: number
  createdAt: string
  updatedAt: string
  latestVersion: string | null
  hasDrift: boolean
  usedByCount: number
}

export const mockSchemas: MockSchema[] = [
  {
    id: 'schema-001',
    name: 'Transaction Events',
    description: 'Kafka event schema for payment transaction events',
    folderId: 'folder-001',
    tags: ['payments', 'events'],
    source: 'kafka',
    registryUrl: null,
    fields: [
      { name: 'transaction_id', type: 'string', nullable: false },
      { name: 'transaction_date', type: 'string', nullable: false },
      { name: 'transaction_amount', type: 'number', nullable: false },
      { name: 'transaction_type', type: 'string', nullable: false },
      { name: 'transaction_description', type: 'string', nullable: true },
      { name: 'merchant_name', type: 'string', nullable: false },
      { name: 'category', type: 'string', nullable: true },
      { name: 'account_balance', type: 'number', nullable: true },
      { name: 'currency', type: 'string', nullable: false },
      { name: 'location', type: 'string', nullable: true },
    ],
    fieldCount: 10,
    pipelineCount: 2,
    createdAt: '2024-01-08T08:00:00Z',
    updatedAt: '2024-02-10T12:00:00Z',
    latestVersion: '2.0.0',
    hasDrift: true,
    usedByCount: 2,
  },
  {
    id: 'schema-002',
    name: 'User Profile',
    description: 'User profile snapshot schema for identity events',
    folderId: 'folder-001',
    tags: ['users', 'identity'],
    source: 'kafka',
    registryUrl: null,
    fields: [
      { name: 'user_id', type: 'string', nullable: false },
      { name: 'email', type: 'string', nullable: false },
      { name: 'display_name', type: 'string', nullable: true },
      { name: 'country', type: 'string', nullable: true },
      { name: 'created_at', type: 'string', nullable: false },
      { name: 'is_verified', type: 'boolean', nullable: false },
    ],
    fieldCount: 6,
    pipelineCount: 1,
    createdAt: '2024-01-09T10:00:00Z',
    updatedAt: '2024-01-20T09:00:00Z',
    latestVersion: '1.0.0',
    hasDrift: false,
    usedByCount: 1,
  },
  {
    id: 'schema-003',
    name: 'Click Stream',
    description: 'Web and mobile click/interaction event schema',
    folderId: null,
    tags: ['analytics', 'clickstream'],
    source: 'otlp',
    registryUrl: null,
    fields: [
      { name: 'session_id', type: 'string', nullable: false },
      { name: 'user_id', type: 'string', nullable: true },
      { name: 'event_name', type: 'string', nullable: false },
      { name: 'page_url', type: 'string', nullable: false },
      { name: 'referrer', type: 'string', nullable: true },
      { name: 'device_type', type: 'string', nullable: true },
      { name: 'timestamp', type: 'string', nullable: false },
      { name: 'duration_ms', type: 'number', nullable: true },
    ],
    fieldCount: 8,
    pipelineCount: 0,
    createdAt: '2024-01-14T13:00:00Z',
    updatedAt: '2024-01-14T13:00:00Z',
    latestVersion: '1.2.0',
    hasDrift: false,
    usedByCount: 0,
  },
]

// ─── Schema versions ──────────────────────────────────────────────────────────

export interface MockSchemaVersion {
  id: string
  schemaId: string
  version: string
  fields: SchemaField[]
  changeSummary: string | null
  createdAt: string
  createdBy: string | null
}

export const mockSchemaVersions: MockSchemaVersion[] = [
  // Transaction Events — 3 published versions
  {
    id: 'sv-001-v1',
    schemaId: 'schema-001',
    version: '1.0.0',
    fields: [
      { name: 'transaction_id', type: 'string', nullable: false },
      { name: 'transaction_date', type: 'string', nullable: false },
      { name: 'transaction_amount', type: 'number', nullable: false },
      { name: 'currency', type: 'string', nullable: false },
    ],
    changeSummary: 'Initial schema — core transaction fields',
    createdAt: '2024-01-08T08:00:00Z',
    createdBy: 'system',
  },
  {
    id: 'sv-001-v2',
    schemaId: 'schema-001',
    version: '1.1.0',
    fields: [
      { name: 'transaction_id', type: 'string', nullable: false },
      { name: 'transaction_date', type: 'string', nullable: false },
      { name: 'transaction_amount', type: 'number', nullable: false },
      { name: 'transaction_type', type: 'string', nullable: false },
      { name: 'merchant_name', type: 'string', nullable: false },
      { name: 'currency', type: 'string', nullable: false },
    ],
    changeSummary: 'Added transaction_type and merchant_name',
    createdAt: '2024-01-22T14:00:00Z',
    createdBy: 'vladimir@glassflow.dev',
  },
  {
    id: 'sv-001-v3',
    schemaId: 'schema-001',
    version: '2.0.0',
    fields: [
      { name: 'transaction_id', type: 'string', nullable: false },
      { name: 'transaction_date', type: 'string', nullable: false },
      { name: 'transaction_amount', type: 'number', nullable: false },
      { name: 'transaction_type', type: 'string', nullable: false },
      { name: 'transaction_description', type: 'string', nullable: true },
      { name: 'merchant_name', type: 'string', nullable: false },
      { name: 'category', type: 'string', nullable: true },
      { name: 'account_balance', type: 'number', nullable: true },
      { name: 'currency', type: 'string', nullable: false },
      { name: 'location', type: 'string', nullable: true },
    ],
    changeSummary: 'Major: added optional enrichment fields (category, balance, location, description)',
    createdAt: '2024-02-10T12:00:00Z',
    createdBy: 'vladimir@glassflow.dev',
  },
  // User Profile — 1 published version
  {
    id: 'sv-002-v1',
    schemaId: 'schema-002',
    version: '1.0.0',
    fields: [
      { name: 'user_id', type: 'string', nullable: false },
      { name: 'email', type: 'string', nullable: false },
      { name: 'display_name', type: 'string', nullable: true },
      { name: 'country', type: 'string', nullable: true },
      { name: 'created_at', type: 'string', nullable: false },
      { name: 'is_verified', type: 'boolean', nullable: false },
    ],
    changeSummary: 'Initial schema',
    createdAt: '2024-01-20T09:00:00Z',
    createdBy: 'system',
  },
]

// ─── Transforms ───────────────────────────────────────────────────────────────

export interface MockTransform {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  language: 'js' | 'sql'
  code: string
  inputSchemaId: string | null
  outputSchemaId: string | null
  createdAt: string
  updatedAt: string
}

export const mockTransforms: MockTransform[] = [
  {
    id: 'transform-001',
    name: 'Anonymize PII',
    description: 'Redacts email and masks user_id for GDPR compliance',
    folderId: 'folder-001',
    tags: ['gdpr', 'privacy'],
    language: 'js',
    code: `// Anonymize PII fields before writing to ClickHouse
function transform(event) {
  return {
    ...event,
    user_id: hashSha256(event.user_id),
    email: event.email ? redactEmail(event.email) : null,
  }
}

function hashSha256(value) {
  // Deterministic hash — preserves join-ability without exposing the raw ID
  return 'hashed_' + value.split('').reverse().join('')
}

function redactEmail(email) {
  const [local, domain] = email.split('@')
  return local[0] + '***@' + domain
}`,
    inputSchemaId: 'schema-002',
    outputSchemaId: null,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-02-08T11:00:00Z',
  },
  {
    id: 'transform-002',
    name: 'Aggregate Daily Transactions',
    description: 'Rolls up transaction events into daily per-user summaries',
    folderId: 'folder-001',
    tags: ['aggregation', 'analytics'],
    language: 'sql',
    code: `SELECT
  user_id,
  toDate(transaction_date)          AS event_date,
  count()                           AS tx_count,
  sum(transaction_amount)           AS total_amount,
  avg(transaction_amount)           AS avg_amount,
  groupArray(transaction_type)      AS tx_types
FROM input
GROUP BY user_id, event_date`,
    inputSchemaId: 'schema-001',
    outputSchemaId: null,
    createdAt: '2024-01-18T14:00:00Z',
    updatedAt: '2024-01-18T14:00:00Z',
  },
]

// ─── Transform versions ───────────────────────────────────────────────────────

export interface MockTransformVersion {
  id: string
  transformId: string
  version: string
  language: 'js' | 'sql'
  code: string
  inputSchemaId: string | null
  outputSchemaId: string | null
  changeSummary: string | null
  createdAt: string
  createdBy: string | null
}

export const mockTransformVersions: MockTransformVersion[] = [
  {
    id: 'tv-001-v1',
    transformId: 'transform-001',
    version: '1.0.0',
    language: 'js',
    code: `function transform(event) {
  return { ...event, email: null }
}`,
    inputSchemaId: 'schema-002',
    outputSchemaId: null,
    changeSummary: 'Initial version — simply drops email',
    createdAt: '2024-01-15T10:00:00Z',
    createdBy: 'system',
  },
  {
    id: 'tv-001-v2',
    transformId: 'transform-001',
    version: '1.1.0',
    language: 'js',
    code: `function transform(event) {
  return {
    ...event,
    user_id: hashSha256(event.user_id),
    email: event.email ? redactEmail(event.email) : null,
  }
}

function hashSha256(value) {
  return 'hashed_' + value.split('').reverse().join('')
}

function redactEmail(email) {
  const [local, domain] = email.split('@')
  return local[0] + '***@' + domain
}`,
    inputSchemaId: 'schema-002',
    outputSchemaId: null,
    changeSummary: 'Hash user_id in addition to redacting email',
    createdAt: '2024-02-08T11:00:00Z',
    createdBy: 'vladimir@glassflow.dev',
  },
]

// ─── Dedup configs ────────────────────────────────────────────────────────────

export type MockDedupConfig = {
  id: string; name: string; description: string | null
  folderId: string | null; tags: string[]
  keyFields: string[]; secondaryKeyFields: string[]
  windowDuration: string; windowType: 'tumbling' | 'sliding'
  timeAttribute: 'event_time' | 'processing_time'
  onDuplicate: 'keep_first' | 'keep_last'
  lateEventPolicy: 'pass_through' | 'drop'
  stateBackend: 'nats-kv' | 'memory'
  latestVersion: string; usedByCount: number; hasDrift: boolean
  createdAt: string; updatedAt: string
}

export const mockDedupConfigs: MockDedupConfig[] = [
  {
    id: 'dedup-1',
    name: 'Order event dedup',
    description: 'Removes duplicate order events within a 10-minute window',
    folderId: null,
    tags: ['production', 'orders'],
    keyFields: ['orderId'],
    secondaryKeyFields: ['eventType'],
    windowDuration: '10m',
    windowType: 'tumbling',
    timeAttribute: 'event_time',
    onDuplicate: 'keep_first',
    lateEventPolicy: 'pass_through',
    stateBackend: 'nats-kv',
    latestVersion: 'v2',
    usedByCount: 3,
    hasDrift: false,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-04-20T14:30:00Z',
  },
  {
    id: 'dedup-2',
    name: 'Click stream dedup',
    description: 'Session-level click deduplication',
    folderId: null,
    tags: ['analytics'],
    keyFields: ['sessionId', 'clickId'],
    secondaryKeyFields: [],
    windowDuration: '5m',
    windowType: 'sliding',
    timeAttribute: 'processing_time',
    onDuplicate: 'keep_last',
    lateEventPolicy: 'drop',
    stateBackend: 'memory',
    latestVersion: 'v1',
    usedByCount: 1,
    hasDrift: true,
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: '2026-05-01T11:00:00Z',
  },
]

// ─── Filter configs ───────────────────────────────────────────────────────────

export type MockFilterRule = { id: string; field: string; operator: string; value: string | null }
export type MockFilterRuleGroup = { id: string; combinator: 'and' | 'or'; rules: Array<MockFilterRule | MockFilterRuleGroup> }
export type MockFilterConfig = {
  id: string; name: string; description: string | null
  folderId: string | null; tags: string[]
  boundSchemaId: string | null
  rules: Array<MockFilterRule | MockFilterRuleGroup>
  latestVersion: string; usedByCount: number
  createdAt: string; updatedAt: string
}

export const mockFilterConfigs: MockFilterConfig[] = [
  {
    id: 'filter-1',
    name: 'High-value orders',
    description: 'Passes only orders with amount > 1000',
    folderId: null,
    tags: ['production', 'orders'],
    boundSchemaId: null,
    rules: [
      { id: 'r1', field: 'amount', operator: 'gt', value: '1000' },
    ],
    latestVersion: 'v1',
    usedByCount: 2,
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-04-15T09:00:00Z',
  },
  {
    id: 'filter-2',
    name: 'Error events only',
    description: 'Passes log lines with severity=error or severity=fatal',
    folderId: null,
    tags: ['observability'],
    boundSchemaId: null,
    rules: [
      {
        id: 'g1',
        combinator: 'or',
        rules: [
          { id: 'r2', field: 'severity', operator: 'eq', value: 'error' },
          { id: 'r3', field: 'severity', operator: 'eq', value: 'fatal' },
        ],
      },
    ],
    latestVersion: 'v3',
    usedByCount: 4,
    createdAt: '2026-02-05T14:00:00Z',
    updatedAt: '2026-05-02T08:30:00Z',
  },
]

// ─── Used-by (pre-wired to mock pipelines) ────────────────────────────────────

export interface MockUsedByEntry {
  pipelineId: string
  pipelineName: string
  pinnedVersion?: string
  health: 'ok' | 'warn' | 'err'
  status: 'active' | 'stopped'
  drift: boolean
}

export const mockUsedBy: Record<string, MockUsedByEntry[]> = {
  // schema-001 (Transaction Events) — used by two pipelines
  'schema-001': [
    { pipelineId: 'pipeline-001', pipelineName: 'Deduplication Pipeline', pinnedVersion: '2.0.0', health: 'ok', status: 'active', drift: false },
    { pipelineId: 'pipeline-003', pipelineName: 'Ingest Only Pipeline', pinnedVersion: '1.1.0', health: 'warn', status: 'active', drift: true },
  ],
  // schema-002 (User Profile) — used by one pipeline
  'schema-002': [
    { pipelineId: 'pipeline-002', pipelineName: 'Deduplication & Join Pipeline', pinnedVersion: '1.0.0', health: 'ok', status: 'active', drift: false },
  ],
  // kafka-001 (Local Kafka) — used by three pipelines (no pinned version for connections)
  'kafka-001': [
    { pipelineId: 'pipeline-001', pipelineName: 'Deduplication Pipeline', health: 'ok', status: 'active', drift: false },
    { pipelineId: 'pipeline-002', pipelineName: 'Deduplication & Join Pipeline', health: 'ok', status: 'active', drift: false },
    { pipelineId: 'pipeline-003', pipelineName: 'Ingest Only Pipeline', health: 'err', status: 'stopped', drift: true },
  ],
  // kafka-002 (Production Kafka) — one pipeline
  'kafka-002': [
    { pipelineId: 'pipeline-005', pipelineName: 'Deduplication & Join Pipeline', health: 'warn', status: 'active', drift: true },
  ],
  // ch-001 (Local ClickHouse) — used by three pipelines
  'ch-001': [
    { pipelineId: 'pipeline-001', pipelineName: 'Deduplication Pipeline', health: 'ok', status: 'active', drift: false },
    { pipelineId: 'pipeline-002', pipelineName: 'Deduplication & Join Pipeline', health: 'ok', status: 'active', drift: false },
    { pipelineId: 'pipeline-004', pipelineName: 'Join Pipeline', health: 'warn', status: 'active', drift: true },
  ],
  // ch-002 (Production ClickHouse Cloud) — two pipelines
  'ch-002': [
    { pipelineId: 'pipeline-003', pipelineName: 'Ingest Only Pipeline', health: 'err', status: 'stopped', drift: false },
    { pipelineId: 'pipeline-005', pipelineName: 'Deduplication & Join Pipeline', health: 'ok', status: 'active', drift: false },
  ],
  // transform-001 (Anonymize PII) — one pipeline
  'transform-001': [
    { pipelineId: 'pipeline-003', pipelineName: 'Ingest Only Pipeline', pinnedVersion: '1.1.0', health: 'err', status: 'stopped', drift: true },
  ],
}
