import { pgSchema, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'
import type { KafkaConfig } from '@/src/lib/kafka-client-interface'
import type { ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'

// Minimal SchemaField definition — will be updated when A3 (src/types/schema.ts) merges
export interface SchemaField {
  name: string
  type: string
  nullable: boolean
}

export type TransformLanguage = 'js' | 'sql'

export const uiLibrary = pgSchema('ui_library')

export const folders = uiLibrary.table('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const kafkaConnections = uiLibrary.table('kafka_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  config: jsonb('config').$type<KafkaConfig>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const clickhouseConnections = uiLibrary.table('clickhouse_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  config: jsonb('config').$type<ClickHouseConfig>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const schemas = uiLibrary.table('schemas', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  fields: jsonb('fields').$type<SchemaField[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const schemaVersions = uiLibrary.table('schema_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  schemaId: uuid('schema_id')
    .references(() => schemas.id, { onDelete: 'cascade' })
    .notNull(),
  version: text('version').notNull(), // semver: '1.4.0'
  fields: jsonb('fields').$type<SchemaField[]>().notNull(),
  changeSummary: text('change_summary'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: text('created_by'),
})

export const transforms = uiLibrary.table('transforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  language: text('language').$type<TransformLanguage>().notNull(),
  code: text('code').notNull(), // current draft / latest
  inputSchemaId: uuid('input_schema_id').references(() => schemas.id, { onDelete: 'set null' }),
  outputSchemaId: uuid('output_schema_id').references(() => schemas.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const transformVersions = uiLibrary.table('transform_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  transformId: uuid('transform_id')
    .references(() => transforms.id, { onDelete: 'cascade' })
    .notNull(),
  version: text('version').notNull(),
  language: text('language').$type<TransformLanguage>().notNull(),
  code: text('code').notNull(),
  inputSchemaId: uuid('input_schema_id'),
  outputSchemaId: uuid('output_schema_id'),
  changeSummary: text('change_summary'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: text('created_by'),
})

// ─── Pipeline revisions / references (Phase 3 — Bridge) ──────────────────────

/**
 * `pipeline_revisions` records every Deploy from Canvas as a new monotonic
 * revision per pipeline. Each revision pins a snapshot of the full
 * PipelineConfig and links to a fixed set of Library resource versions via
 * `pipeline_references`. Library schema/transform bumps never auto-mutate a
 * deployed pipeline; an upgrade is always a new revision.
 */
export const pipelineRevisions = uiLibrary.table('pipeline_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipelineId: text('pipeline_id').notNull(),
  revision: integer('revision').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  env: text('env').notNull().default('production'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: text('created_by'),
})

export type PipelineResourceKind =
  | 'kafka_connection'
  | 'clickhouse_connection'
  | 'schema'
  | 'transform'

/**
 * `pipeline_references` rows pin each library resource a revision uses to a
 * specific version (for schemas / transforms — `pinnedVersion` is the semver
 * string) or marks it as live (for connections — `pinnedVersion` is null).
 */
export const pipelineReferences = uiLibrary.table('pipeline_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  revisionId: uuid('revision_id')
    .references(() => pipelineRevisions.id, { onDelete: 'cascade' })
    .notNull(),
  // Denormalized for cheap GROUP-BY on the used-by lookup path.
  pipelineId: text('pipeline_id').notNull(),
  resourceKind: text('resource_kind').$type<PipelineResourceKind>().notNull(),
  resourceId: uuid('resource_id').notNull(),
  pinnedVersion: text('pinned_version'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
