import {
  createClickHouseConnection,
  closeConnection,
  buildTestQuery,
  parseTestResult,
  parseTabSeparated,
  parseJSONEachRow,
  buildSchemaQuery,
  buildFallbackSchemaQuery,
  type ClickHouseConfig,
} from '@/src/app/api/clickhouse/clickhouse-utils'

export class ClickhouseService {
  async testConnection({
    config,
    testType = 'connection',
    database,
    table,
  }: {
    config: ClickHouseConfig
    testType?: string
    database?: string
    table?: string
  }) {
    try {
      const connection = await createClickHouseConnection(config)

      if (connection.type === 'direct' && connection.directFetch) {
        // Direct HTTP approach for SSL connections
        const query = buildTestQuery(testType, database, table)
        const data = await connection.directFetch(query)
        const result = parseTestResult(testType, data, database, table)
        return {
          ...result,
          method: 'direct-http',
        }
      } else if (connection.type === 'client' && connection.client) {
        try {
          await connection.client.ping()

          if (testType === 'connection') {
            const result = await connection.client.query({
              query: 'SHOW DATABASES',
              format: 'JSONEachRow',
            })
            const rows = (await result.json()) as { name: string }[]
            const databases = rows.map((row) => row.name)
            await closeConnection(connection)
            return {
              success: true,
              message: 'Successfully connected to ClickHouse',
              databases,
            }
          } else if (testType === 'database' && database) {
            const result = await connection.client.query({
              query: `SHOW TABLES FROM ${database}`,
              format: 'JSONEachRow',
            })
            const rows = (await result.json()) as { name: string }[]
            const tables = rows.map((row) => row.name)
            await closeConnection(connection)
            return {
              success: true,
              message: `Successfully connected to database '${database}'`,
              tables,
            }
          } else if (testType === 'table' && database && table) {
            const result = await connection.client.query({
              query: `SELECT * FROM ${database}.${table} LIMIT 1`,
              format: 'JSONEachRow',
            })
            const rows = await result.json()
            await closeConnection(connection)
            return {
              success: true,
              message: `Successfully accessed table '${table}' in database '${database}'`,
              sample: rows,
            }
          } else {
            await closeConnection(connection)
            return {
              success: false,
              error: `Invalid test type: ${testType}`,
            }
          }
        } catch (error) {
          await closeConnection(connection)
          throw error
        }
      } else {
        throw new Error('Invalid connection configuration')
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to ClickHouse server',
      }
    }
  }

  async getDatabases(config: ClickHouseConfig) {
    try {
      const connection = await createClickHouseConnection(config)
      if (connection.type === 'direct' && connection.directFetch) {
        const data = await connection.directFetch('SHOW DATABASES FORMAT TabSeparated')
        const databases = parseTabSeparated(data)
        return {
          success: true,
          databases,
          method: 'direct-http',
        }
      } else if (connection.type === 'client' && connection.client) {
        const result = await connection.client.query({
          query: 'SHOW DATABASES',
          format: 'JSONEachRow',
        })
        const rows = (await result.json()) as { name: string }[]
        const databases = rows.map((row) => row.name)
        await closeConnection(connection)
        return {
          success: true,
          databases,
        }
      } else {
        throw new Error('Invalid connection configuration')
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch databases',
      }
    }
  }

  async getTables(config: ClickHouseConfig, database: string) {
    if (!database) {
      return {
        success: false,
        error: 'Database name is required',
        status: 400,
      }
    }
    try {
      const connection = await createClickHouseConnection(config)
      if (connection.type === 'direct' && connection.directFetch) {
        const data = await connection.directFetch(`SHOW TABLES FROM ${database} FORMAT TabSeparated`)
        const tables = parseTabSeparated(data)
        return {
          success: true,
          tables,
          method: 'direct-http',
        }
      } else if (connection.type === 'client' && connection.client) {
        const result = await connection.client.query({
          query: `SHOW TABLES FROM ${database}`,
          format: 'JSONEachRow',
        })
        const rows = (await result.json()) as { name: string }[]
        const tables = rows.map((row) => row.name)
        await closeConnection(connection)
        return {
          success: true,
          tables,
        }
      } else {
        throw new Error('Invalid connection configuration')
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : `Failed to fetch tables for database '${database}'`,
      }
    }
  }

  async getTableSchema(config: ClickHouseConfig, database: string, table: string) {
    if (!database || !table) {
      return {
        success: false,
        error: 'Database and table names are required',
        status: 400,
      }
    }
    try {
      const connection = await createClickHouseConnection(config)
      if (connection.type === 'direct' && connection.directFetch) {
        try {
          const query = buildSchemaQuery(database, table)
          const data = await connection.directFetch(query)
          const columns = parseJSONEachRow(data)
          return {
            success: true,
            columns,
          }
        } catch (error) {
          // Try fallback query for regular tables
          if (database !== 'information_schema' && database !== 'system') {
            try {
              const fallbackQuery = buildFallbackSchemaQuery(database, table)
              const data = await connection.directFetch(fallbackQuery)
              const columns = parseJSONEachRow(data)
              return {
                success: true,
                columns,
              }
            } catch (fallbackError) {
              throw fallbackError
            }
          }
          throw error
        }
      } else if (connection.type === 'client' && connection.client) {
        const result = await connection.client.query({
          query: `DESCRIBE TABLE ${database}.${table}`,
          format: 'JSONEachRow',
        })
        const columns = await result.json()
        await closeConnection(connection)
        return {
          success: true,
          columns,
        }
      } else {
        throw new Error('Invalid connection configuration')
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : `Failed to fetch schema for table '${table}' in database '${database}'`,
      }
    }
  }
}
