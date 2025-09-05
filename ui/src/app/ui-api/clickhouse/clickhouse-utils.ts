import { createClient, ClickHouseClient } from '@clickhouse/client'
import { generateHost } from '@/src/utils/common.server'
import { Agent } from 'undici'

interface ClickHouseConnection {
  type: 'direct' | 'client'
  directFetch?: (query: string) => Promise<string>
  client?: ClickHouseClient
  cleanHost?: string
  dispatcher?: Agent
}

export interface ClickHouseConfig {
  host: string
  httpPort: number
  nativePort?: number
  username: string
  password: string
  database?: string
  useSSL?: boolean
  connectionType?: string
  proxyUrl?: string
  connectionString?: string
  skipCertificateVerification?: boolean
}

export async function createClickHouseConnection(config: ClickHouseConfig): Promise<ClickHouseConnection> {
  const {
    host,
    httpPort: httpPort,
    nativePort,
    username,
    password,
    database,
    useSSL = true,
    skipCertificateVerification = false,
  } = config

  // Direct connection logic
  const urlObj = new URL(
    generateHost({
      host,
      httpPort: httpPort.toString(),
      username,
      password,
      useSSL,
      nativePort: nativePort?.toString(),
    }),
  )
  const cleanHost = urlObj.hostname
  const encodedUsername = encodeURIComponent(username)
  const encodedPassword = encodeURIComponent(password)
  const url = `${useSSL ? 'https' : 'http'}://${encodedUsername}:${encodedPassword}@${cleanHost}:${httpPort}`

  if (useSSL) {
    // Always use direct HTTP for SSL connections
    const dispatcher = new Agent({
      connect: {
        rejectUnauthorized: !skipCertificateVerification,
      },
    })

    const directFetch = async (query: string): Promise<string> => {
      const testUrl = `${useSSL ? 'https' : 'http'}://${cleanHost}:${httpPort}/?query=${encodeURIComponent(query)}`
      const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
        },
        // @ts-expect-error - undici dispatcher not in standard fetch types
        dispatcher,
      })

      if (response.ok) {
        return await response.text()
      } else {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }
    }

    return { type: 'direct', directFetch, cleanHost, dispatcher }
  } else {
    // Use ClickHouse client for HTTP connections
    const client = createClient({
      url,
      request_timeout: 30000,
      keep_alive: {
        enabled: true,
        idle_socket_ttl: 25000,
      },
    })
    return { type: 'client', client }
  }
}

// Helper functions for parsing responses
export function parseTabSeparated(data: string): string[] {
  return data
    .trim()
    .split('\n')
    .filter((item) => item.trim() !== '')
}

export function parseJSONEachRow(data: string): any[] {
  return data
    .trim()
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

// TODO: not used - check and remove if not needed
export async function executeQuery(connection: ClickHouseConnection, query: string): Promise<string> {
  if (connection.type === 'direct' && connection.directFetch) {
    return await connection.directFetch(query)
  } else if (connection.type === 'client' && connection.client) {
    const result = await connection.client.query({
      query,
      format: 'JSONEachRow',
    })
    const rows = await result.json()
    return JSON.stringify(rows)
  } else {
    throw new Error('Invalid connection type or missing connection method')
  }
}

export async function closeConnection(connection: ClickHouseConnection): Promise<void> {
  if (connection.type === 'client' && connection.client) {
    await connection.client.close()
  }
  // Direct connections don't need explicit closing
}

// Specialized function for schema queries
export function buildSchemaQuery(database: string, table: string): string {
  if (database === 'information_schema') {
    // For information_schema, use standard SQL approach
    return `SELECT column_name as name, data_type as type, is_nullable, column_default as default_expression FROM information_schema.columns WHERE table_schema = '${database}' AND table_name = '${table}' FORMAT JSONEachRow`
  } else if (database === 'system') {
    // For system database, use ClickHouse system tables
    return `SELECT name, type, default_kind, default_expression FROM system.columns WHERE database = '${database}' AND table = '${table}' FORMAT JSONEachRow`
  } else {
    // For regular databases, use DESCRIBE TABLE
    return `DESCRIBE TABLE \`${database}\`.\`${table}\` FORMAT JSONEachRow`
  }
}

// Fallback schema query without backticks
export function buildFallbackSchemaQuery(database: string, table: string): string {
  return `DESCRIBE TABLE ${database}.${table} FORMAT JSONEachRow`
}

// Specialized functions for test-connection queries
export function buildTestQuery(testType: string, database?: string, table?: string): string {
  switch (testType) {
    case 'connection':
      return 'SHOW DATABASES FORMAT TabSeparated'
    case 'database':
      if (!database) throw new Error('Database name required for database test')
      return `SHOW TABLES FROM ${database} FORMAT TabSeparated`
    case 'table':
      if (!database || !table) throw new Error('Database and table names required for table test')
      return `SELECT * FROM ${database}.${table} LIMIT 1 FORMAT JSONEachRow`
    default:
      throw new Error(`Invalid test type: ${testType}`)
  }
}

// Parse test results based on test type
export function parseTestResult(testType: string, data: string, database?: string, table?: string) {
  switch (testType) {
    case 'connection':
      return {
        success: true,
        message: 'Successfully connected to ClickHouse',
        databases: parseTabSeparated(data),
      }
    case 'database':
      return {
        success: true,
        message: `Successfully connected to database '${database}'`,
        tables: parseTabSeparated(data),
      }
    case 'table':
      return {
        success: true,
        message: `Successfully accessed table '${table}' in database '${database}'`,
        sample: parseJSONEachRow(data),
      }
    default:
      throw new Error(`Invalid test type: ${testType}`)
  }
}
