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
  fields: SchemaField[]
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
    fields: [
      { name: 'user_id', type: 'string', nullable: false },
      { name: 'email', type: 'string', nullable: false },
      { name: 'display_name', type: 'string', nullable: true },
      { name: 'country', type: 'string', nullable: true },
      { name: 'created_at', type: 'string', nullable: false },
      { name: 'is_verified', type: 'boolean', nullable: false },
    ],
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
