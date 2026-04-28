import { pgSchema, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import type { KafkaConfig } from '@/src/lib/kafka-client-interface'
import type { ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'

// Minimal SchemaField definition — will be updated when A3 (src/types/schema.ts) merges
export interface SchemaField {
  name: string
  type: string
  nullable: boolean
}

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
