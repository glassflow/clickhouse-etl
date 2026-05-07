/**
 * In-memory CRUD state for the Library mock layer.
 *
 * Module-level Maps persist for the lifetime of the dev server process.
 * All mock route handlers read/write through these helpers instead of Drizzle.
 *
 * Semver bump logic mirrors the real computeNextSemver in semver-util.ts so
 * version publish behaves identically in mock and production modes.
 */

import {
  mockFolders,
  mockKafkaConnections,
  mockClickhouseConnections,
  mockSchemas,
  mockSchemaVersions,
  mockTransforms,
  mockTransformVersions,
  mockUsedBy,
  mockDedupConfigs,
  mockFilterConfigs,
  type MockFolder,
  type MockKafkaConnection,
  type MockClickhouseConnection,
  type MockSchema,
  type MockSchemaVersion,
  type MockTransform,
  type MockTransformVersion,
  type MockUsedByEntry,
  type MockDedupConfig,
  type MockFilterConfig,
} from './library'

// ─── In-memory stores ─────────────────────────────────────────────────────────

const folders = new Map<string, MockFolder>()
const kafkaConnections = new Map<string, MockKafkaConnection>()
const clickhouseConnections = new Map<string, MockClickhouseConnection>()
const schemas = new Map<string, MockSchema>()
const schemaVersions = new Map<string, MockSchemaVersion>()
const transforms = new Map<string, MockTransform>()
const transformVersions = new Map<string, MockTransformVersion>()
const usedBy = new Map<string, MockUsedByEntry[]>()

let initialized = false

function init() {
  if (initialized) return
  initialized = true
  mockFolders.forEach((f) => folders.set(f.id, { ...f }))
  mockKafkaConnections.forEach((c) => kafkaConnections.set(c.id, { ...c }))
  mockClickhouseConnections.forEach((c) => clickhouseConnections.set(c.id, { ...c }))
  mockSchemas.forEach((s) => schemas.set(s.id, { ...s }))
  mockSchemaVersions.forEach((v) => schemaVersions.set(v.id, { ...v }))
  mockTransforms.forEach((t) => transforms.set(t.id, { ...t }))
  mockTransformVersions.forEach((v) => transformVersions.set(v.id, { ...v }))
  Object.entries(mockUsedBy).forEach(([id, entries]) => usedBy.set(id, [...entries]))
}

// ─── Semver helper (mirrors real semver-util.ts) ─────────────────────────────

function bumpSemver(latest: string | null, bump: 'major' | 'minor' | 'patch'): string {
  if (!latest) return '1.0.0'
  const [major, minor, patch] = latest.split('.').map(Number)
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function uuid(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function now(): string {
  return new Date().toISOString()
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export function listFolders(): MockFolder[] {
  init()
  return Array.from(folders.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function createFolder(data: { name: string; parentId?: string | null }): MockFolder {
  init()
  const folder: MockFolder = {
    id: uuid(),
    name: data.name,
    parentId: data.parentId ?? null,
    createdAt: now(),
  }
  folders.set(folder.id, folder)
  return folder
}

// ─── Kafka connections ────────────────────────────────────────────────────────

export function listKafkaConnections(): MockKafkaConnection[] {
  init()
  return Array.from(kafkaConnections.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function getKafkaConnection(id: string): MockKafkaConnection | undefined {
  init()
  return kafkaConnections.get(id)
}

export function createKafkaConnection(
  data: Omit<MockKafkaConnection, 'id' | 'createdAt' | 'updatedAt'>,
): MockKafkaConnection {
  init()
  const conn: MockKafkaConnection = {
    ...data,
    id: uuid(),
    createdAt: now(),
    updatedAt: now(),
  }
  kafkaConnections.set(conn.id, conn)
  return conn
}

export function updateKafkaConnection(
  id: string,
  data: Partial<Omit<MockKafkaConnection, 'id' | 'createdAt'>>,
): MockKafkaConnection | undefined {
  init()
  const existing = kafkaConnections.get(id)
  if (!existing) return undefined
  const updated = { ...existing, ...data, updatedAt: now() }
  kafkaConnections.set(id, updated)
  return updated
}

export function deleteKafkaConnection(id: string): boolean {
  init()
  return kafkaConnections.delete(id)
}

export function getKafkaConnectionUsedBy(id: string): MockUsedByEntry[] {
  init()
  return usedBy.get(id) ?? []
}

// ─── ClickHouse connections ───────────────────────────────────────────────────

export function listClickhouseConnections(): MockClickhouseConnection[] {
  init()
  return Array.from(clickhouseConnections.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function getClickhouseConnection(id: string): MockClickhouseConnection | undefined {
  init()
  return clickhouseConnections.get(id)
}

export function createClickhouseConnection(
  data: Omit<MockClickhouseConnection, 'id' | 'createdAt' | 'updatedAt'>,
): MockClickhouseConnection {
  init()
  const conn: MockClickhouseConnection = {
    ...data,
    id: uuid(),
    createdAt: now(),
    updatedAt: now(),
  }
  clickhouseConnections.set(conn.id, conn)
  return conn
}

export function updateClickhouseConnection(
  id: string,
  data: Partial<Omit<MockClickhouseConnection, 'id' | 'createdAt'>>,
): MockClickhouseConnection | undefined {
  init()
  const existing = clickhouseConnections.get(id)
  if (!existing) return undefined
  const updated = { ...existing, ...data, updatedAt: now() }
  clickhouseConnections.set(id, updated)
  return updated
}

export function deleteClickhouseConnection(id: string): boolean {
  init()
  return clickhouseConnections.delete(id)
}

export function getClickhouseConnectionUsedBy(id: string): MockUsedByEntry[] {
  init()
  return usedBy.get(id) ?? []
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

export function listSchemas(): MockSchema[] {
  init()
  return Array.from(schemas.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function getSchema(id: string): MockSchema | undefined {
  init()
  return schemas.get(id)
}

export function createSchema(
  data: Omit<MockSchema, 'id' | 'createdAt' | 'updatedAt'>,
): MockSchema {
  init()
  const schema: MockSchema = {
    ...data,
    id: uuid(),
    createdAt: now(),
    updatedAt: now(),
  }
  schemas.set(schema.id, schema)
  return schema
}

export function updateSchema(
  id: string,
  data: Partial<Omit<MockSchema, 'id' | 'createdAt'>>,
): MockSchema | undefined {
  init()
  const existing = schemas.get(id)
  if (!existing) return undefined
  const updated = { ...existing, ...data, updatedAt: now() }
  schemas.set(id, updated)
  return updated
}

export function deleteSchema(id: string): boolean {
  init()
  return schemas.delete(id)
}

export function getSchemaUsedBy(id: string): MockUsedByEntry[] {
  init()
  return usedBy.get(id) ?? []
}

// ─── Schema versions ──────────────────────────────────────────────────────────

export function listSchemaVersions(schemaId: string): MockSchemaVersion[] {
  init()
  return Array.from(schemaVersions.values())
    .filter((v) => v.schemaId === schemaId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getSchemaVersion(schemaId: string, version: string): MockSchemaVersion | undefined {
  init()
  return Array.from(schemaVersions.values()).find(
    (v) => v.schemaId === schemaId && v.version === version,
  )
}

export function publishSchemaVersion(
  schemaId: string,
  data: {
    bump: 'major' | 'minor' | 'patch'
    fields: MockSchemaVersion['fields']
    changeSummary?: string
  },
): MockSchemaVersion | undefined {
  init()
  const parent = schemas.get(schemaId)
  if (!parent) return undefined

  const existing = listSchemaVersions(schemaId)
  const latestVersion = existing[0]?.version ?? null
  const nextVersion = bumpSemver(latestVersion, data.bump)

  const version: MockSchemaVersion = {
    id: uuid(),
    schemaId,
    version: nextVersion,
    fields: data.fields,
    changeSummary: data.changeSummary ?? null,
    createdAt: now(),
    createdBy: null,
  }
  schemaVersions.set(version.id, version)

  // Sync live schema fields to match the published version
  schemas.set(schemaId, { ...parent, fields: data.fields, updatedAt: now() })

  return version
}

export function rolloutSchema(
  _schemaId: string,
  data: { targetPipelineIds: string[]; toVersion: string; mode: 'atomic' | 'staged' },
): Array<{ pipelineId: string; revision?: number; error?: string }> {
  init()
  // In mock mode, simulate a successful rollout for each target pipeline
  return data.targetPipelineIds.map((pipelineId, i) => ({
    pipelineId,
    revision: i + 2, // pretend the new revision number
  }))
}

// ─── Transforms ───────────────────────────────────────────────────────────────

export function listTransforms(): MockTransform[] {
  init()
  return Array.from(transforms.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function getTransform(id: string): MockTransform | undefined {
  init()
  return transforms.get(id)
}

export function createTransform(
  data: Omit<MockTransform, 'id' | 'createdAt' | 'updatedAt'>,
): MockTransform {
  init()
  const transform: MockTransform = {
    ...data,
    id: uuid(),
    createdAt: now(),
    updatedAt: now(),
  }
  transforms.set(transform.id, transform)
  return transform
}

export function updateTransform(
  id: string,
  data: Partial<Omit<MockTransform, 'id' | 'createdAt'>>,
): MockTransform | undefined {
  init()
  const existing = transforms.get(id)
  if (!existing) return undefined
  const updated = { ...existing, ...data, updatedAt: now() }
  transforms.set(id, updated)
  return updated
}

export function deleteTransform(id: string): boolean {
  init()
  return transforms.delete(id)
}

export function getTransformUsedBy(id: string): MockUsedByEntry[] {
  init()
  return usedBy.get(id) ?? []
}

// ─── Transform versions ───────────────────────────────────────────────────────

export function listTransformVersions(transformId: string): MockTransformVersion[] {
  init()
  return Array.from(transformVersions.values())
    .filter((v) => v.transformId === transformId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function publishTransformVersion(
  transformId: string,
  data: {
    bump: 'major' | 'minor' | 'patch'
    language: 'js' | 'sql'
    code: string
    inputSchemaId?: string | null
    outputSchemaId?: string | null
    changeSummary?: string
  },
): MockTransformVersion | undefined {
  init()
  const parent = transforms.get(transformId)
  if (!parent) return undefined

  const existing = listTransformVersions(transformId)
  const latestVersion = existing[0]?.version ?? null
  const nextVersion = bumpSemver(latestVersion, data.bump)

  const version: MockTransformVersion = {
    id: uuid(),
    transformId,
    version: nextVersion,
    language: data.language,
    code: data.code,
    inputSchemaId: data.inputSchemaId ?? null,
    outputSchemaId: data.outputSchemaId ?? null,
    changeSummary: data.changeSummary ?? null,
    createdAt: now(),
    createdBy: null,
  }
  transformVersions.set(version.id, version)

  // Sync live transform to the latest version
  transforms.set(transformId, {
    ...parent,
    language: data.language,
    code: data.code,
    inputSchemaId: data.inputSchemaId ?? null,
    outputSchemaId: data.outputSchemaId ?? null,
    updatedAt: now(),
  })

  return version
}

// ─── Dedup configs ────────────────────────────────────────────────────────────

const dedupConfigs = new Map<string, MockDedupConfig>()

function initDedupConfigs() {
  mockDedupConfigs.forEach(d => dedupConfigs.set(d.id, { ...d }))
}
initDedupConfigs()

export function listDedupConfigs(): MockDedupConfig[] {
  return Array.from(dedupConfigs.values())
}

export function getDedupConfig(id: string): MockDedupConfig | undefined {
  return dedupConfigs.get(id)
}

export function updateDedupConfig(id: string, patch: Partial<MockDedupConfig>): MockDedupConfig | null {
  const existing = dedupConfigs.get(id)
  if (!existing) return null
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  dedupConfigs.set(id, updated)
  return updated
}

export function deleteDedupConfig(id: string): boolean {
  return dedupConfigs.delete(id)
}

// ─── Filter configs ───────────────────────────────────────────────────────────

const filterConfigs = new Map<string, MockFilterConfig>()
mockFilterConfigs.forEach(f => filterConfigs.set(f.id, { ...f }))

export function listFilterConfigs(): MockFilterConfig[] {
  return Array.from(filterConfigs.values())
}

export function getFilterConfig(id: string): MockFilterConfig | undefined {
  return filterConfigs.get(id)
}

export function updateFilterConfig(id: string, patch: Partial<MockFilterConfig>): MockFilterConfig | null {
  const existing = filterConfigs.get(id)
  if (!existing) return null
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  filterConfigs.set(id, updated)
  return updated
}

export function deleteFilterConfig(id: string): boolean {
  return filterConfigs.delete(id)
}
