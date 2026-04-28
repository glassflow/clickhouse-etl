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
