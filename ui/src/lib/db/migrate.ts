import { db } from './index'
import fs from 'fs'
import path from 'path'

export async function runMigrations() {
  const migDir = path.join(process.cwd(), 'src/lib/db/migrations')
  const files = fs.readdirSync(migDir).sort()
  for (const file of files) {
    if (!file.endsWith('.sql')) continue
    const sql = fs.readFileSync(path.join(migDir, file), 'utf-8')
    // Cast needed: execute() is available on both PG and SQLite drizzle instances at runtime
    // but is not in the shared union type surface — this is an intentional escape hatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as unknown as { execute: (sql: string) => Promise<void> }).execute(sql)
  }
}
