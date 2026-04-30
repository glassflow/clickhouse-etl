import { pgSchema, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
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
