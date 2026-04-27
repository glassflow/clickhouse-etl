import { drizzle as drizzlePg, PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

type Schema = typeof schema

/**
 * Creates the DB instance.
 * - Production/staging: uses DATABASE_URL (Postgres via postgres-js)
 * - Local dev fallback: uses SQLite (better-sqlite3) when DATABASE_URL is not set.
 *   Both drivers expose the same Drizzle query API at runtime; we cast to the Postgres
 *   type so callers get full type-safe query builder support without duplication.
 */
function createDb(): PostgresJsDatabase<Schema> {
  const url = process.env.DATABASE_URL
  if (url) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require('postgres')
    const client = postgres(url)
    return drizzlePg(client, { schema })
  }
  // SQLite fallback for local dev — use require() to avoid bundling the optional native dep
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzleSqlite } = require('drizzle-orm/better-sqlite3')
  const sqlite = new Database('.library.db')
  // Cast: SQLite and Postgres drizzle instances share the same query builder surface
  return drizzleSqlite(sqlite, { schema }) as unknown as PostgresJsDatabase<Schema>
}

// Lazy singleton — defers createDb() until the first request-time property access.
// Calling createDb() at module load would trigger require('better-sqlite3') during
// `next build`'s static analysis pass, crashing the build when the native binding
// isn't compiled for the current Node version (or DATABASE_URL isn't set).
let _instance: PostgresJsDatabase<Schema> | null = null

function getInstance(): PostgresJsDatabase<Schema> {
  if (!_instance) _instance = createDb()
  return _instance
}

export const db: PostgresJsDatabase<Schema> = new Proxy({} as PostgresJsDatabase<Schema>, {
  get(_target, prop) {
    return (getInstance() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type DbClient = PostgresJsDatabase<Schema>
