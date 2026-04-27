import path from 'path'

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src/lib/db/migrations')

export async function runMigrations(): Promise<void> {
  if (process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pg = require('postgres')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/postgres-js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require('drizzle-orm/postgres-js/migrator')
    const client = pg(process.env.DATABASE_URL)
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER })
    await client.end()
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/better-sqlite3')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require('drizzle-orm/better-sqlite3/migrator')
    const sqlite = new Database('.library.db')
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER })
    sqlite.close()
  }
}
