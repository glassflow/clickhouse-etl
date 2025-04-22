import { ClickHouseClient, createClient } from '@clickhouse/client'

export interface ClickhouseConfig {
  host: string
  port: string
  username: string
  password: string
  database: string
  useSSL: boolean
  secure: boolean
  connectionType: 'direct' | 'proxy'
  proxyUrl?: string
  connectionString?: string
}

export class ClickhouseService {
  private client: ClickHouseClient | null = null
  private config: ClickhouseConfig

  constructor(config: ClickhouseConfig) {
    this.config = config
  }

  async connect(): Promise<ClickHouseClient> {
    if (this.client) {
      return this.client
    }

    const { host, port, username, password, database, useSSL, secure, connectionType, proxyUrl, connectionString } =
      this.config

    if (connectionType === 'proxy' && proxyUrl) {
      this.client = createClient({
        url: proxyUrl,
        username,
        password,
        database,
      })
    } else {
      const protocol = useSSL ? 'https' : 'http'
      this.client = createClient({
        url: `${protocol}://${host}:${port}`,
        username,
        password,
        database,
        tls: {
          // @ts-expect-error - FIXME: fix this later
          rejectUnauthorized: !secure,
        },
      })
    }

    return this.client
  }

  async query<T = any>(query: string, format: string = 'JSONEachRow'): Promise<T[]> {
    const client = await this.connect()

    const result = await client.query({
      query,
      // @ts-expect-error - FIXME: fix this later
      format,
    })

    // @ts-expect-error - FIXME: fix this later
    return result.json<T[]>()
  }

  async execute(query: string): Promise<void> {
    const client = await this.connect()

    await client.exec({
      query,
    })
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
  }

  async getDatabases(): Promise<string[]> {
    const results = await this.query<{ name: string }>('SHOW DATABASES')
    return results.map((row) => row.name)
  }

  async getTables(database?: string): Promise<string[]> {
    const db = database || this.config.database
    const results = await this.query<{ name: string }>(`SHOW TABLES FROM ${db}`)
    return results.map((row) => row.name)
  }

  async getTableSchema(table: string, database?: string): Promise<any[]> {
    const db = database || this.config.database
    return this.query(`DESCRIBE TABLE ${db}.${table}`)
  }
}

// Singleton instance for app-wide use
let clickhouseService: ClickhouseService | null = null

export function getClickhouseService(config?: ClickhouseConfig): ClickhouseService {
  if (!clickhouseService && config) {
    clickhouseService = new ClickhouseService(config)
  } else if (!clickhouseService && !config) {
    throw new Error('ClickHouse service not initialized. Provide configuration first.')
  }

  return clickhouseService!
}

export function initClickhouseService(config: ClickhouseConfig): ClickhouseService {
  clickhouseService = new ClickhouseService(config)
  return clickhouseService
}
