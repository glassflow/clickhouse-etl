import { z } from 'zod'

// ─── Shared ─────────────────────────────────────────────────────────────────

const optionalUuid = z.string().uuid().optional().nullable()
const tags = z.array(z.string()).optional()
const optionalText = z.string().optional().nullable()

// ─── Kafka connections ───────────────────────────────────────────────────────

// config is validated as an opaque record at the API boundary; Drizzle's $type<KafkaConfig>
// enforces shape at the query layer — cast happens in the route handler.
export const CreateKafkaConnectionInput = z.object({
  name: z.string().min(1),
  description: optionalText,
  folderId: optionalUuid,
  tags,
  config: z.record(z.unknown()),
})

export const UpdateKafkaConnectionInput = z.object({
  name: z.string().min(1).optional(),
  description: optionalText,
  folderId: optionalUuid,
  tags,
  config: z.record(z.unknown()).optional(),
})

// ─── ClickHouse connections ──────────────────────────────────────────────────

export const CreateClickhouseConnectionInput = z.object({
  name: z.string().min(1),
  description: optionalText,
  folderId: optionalUuid,
  tags,
  config: z.record(z.unknown()),
})

export const UpdateClickhouseConnectionInput = z.object({
  name: z.string().min(1).optional(),
  description: optionalText,
  folderId: optionalUuid,
  tags,
  config: z.record(z.unknown()).optional(),
})

// ─── Schemas ─────────────────────────────────────────────────────────────────

const SchemaFieldInput = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  nullable: z.boolean(),
})

export const CreateSchemaInput = z.object({
  name: z.string().min(1),
  description: optionalText,
  folderId: optionalUuid,
  tags,
  fields: z.array(SchemaFieldInput),
})

export const UpdateSchemaInput = z.object({
  name: z.string().min(1).optional(),
  description: optionalText,
  folderId: optionalUuid,
  tags,
  fields: z.array(SchemaFieldInput).optional(),
})

// ─── Folders ─────────────────────────────────────────────────────────────────

export const CreateFolderInput = z.object({
  name: z.string().min(1),
  parentId: optionalUuid,
})

export const UpdateFolderInput = z.object({
  name: z.string().min(1).optional(),
  parentId: optionalUuid,
})

// ─── Schema versions ─────────────────────────────────────────────────────────

export const SchemaFieldZ = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  nullable: z.boolean(),
})

export const PublishSchemaVersionInput = z.object({
  bump: z.enum(['major', 'minor', 'patch']),
  changeSummary: z.string().max(2000).optional(),
  fields: z.array(SchemaFieldZ).min(1),
})

// ─── Transforms ──────────────────────────────────────────────────────────────

export const CreateTransformInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  folderId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).default([]),
  language: z.enum(['js', 'sql']),
  code: z.string().min(1),
  inputSchemaId: z.string().uuid().optional().nullable(),
  outputSchemaId: z.string().uuid().optional().nullable(),
})

export const UpdateTransformInput = CreateTransformInput.partial()

export const PublishTransformVersionInput = z.object({
  bump: z.enum(['major', 'minor', 'patch']),
  changeSummary: z.string().max(2000).optional(),
  language: z.enum(['js', 'sql']),
  code: z.string().min(1),
  inputSchemaId: z.string().uuid().optional().nullable(),
  outputSchemaId: z.string().uuid().optional().nullable(),
})

// ─── Pipeline revisions / references (Phase 3 — Bridge) ──────────────────────

export const PipelineResourceKindZ = z.enum([
  'kafka_connection',
  'clickhouse_connection',
  'schema',
  'transform',
])

export const PipelineReferenceInput = z.object({
  resourceKind: PipelineResourceKindZ,
  resourceId: z.string().uuid(),
  pinnedVersion: z.string().nullable().optional(),
})

export const CreateRevisionInput = z.object({
  env: z.string().default('production'),
  config: z.record(z.string(), z.unknown()),
  references: z.array(PipelineReferenceInput).default([]),
})
