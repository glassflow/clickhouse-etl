import { NextResponse } from 'next/server'
import {
  createClickHouseConnection,
  closeConnection,
  buildTestQuery,
  parseTestResult,
  type ClickHouseConfig,
} from '@/src/utils/clickhouse'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const requestBody = await request.json()

    const { database, testType = 'connection' } = requestBody

    const config: ClickHouseConfig = {
      host: requestBody.host,
      port: requestBody.port,
      nativePort: requestBody.nativePort,
      username: requestBody.username,
      password: requestBody.password,
      database: testType !== 'connection' ? database : undefined,
      useSSL: requestBody.useSSL ?? true,
      secure: requestBody.secure,
      connectionType: requestBody.connectionType,
      proxyUrl: requestBody.proxyUrl,
      connectionString: requestBody.connectionString,
    }

    try {
      const connection = await createClickHouseConnection(config)

      if (connection.type === 'direct' && connection.directFetch) {
        // Direct HTTP approach for SSL connections
        const query = buildTestQuery(testType, database, requestBody.table)
        const data = await connection.directFetch(query)
        const result = parseTestResult(testType, data, database, requestBody.table)

        return NextResponse.json({
          ...result,
          method: 'direct-http',
        })
      } else if (connection.type === 'client' && connection.client) {
        // ClickHouse client approach for HTTP connections
        try {
          const pingResult = await connection.client.ping()

          // Handle different test types
          if (testType === 'connection') {
            // Get available databases
            const result = await connection.client.query({
              query: 'SHOW DATABASES',
              format: 'JSONEachRow',
            })

            const rows = (await result.json()) as { name: string }[]
            const databases = rows.map((row) => row.name)

            await closeConnection(connection)

            return NextResponse.json({
              success: true,
              message: 'Successfully connected to ClickHouse',
              databases,
            })
          } else if (testType === 'database' && database) {
            // Test database access
            const result = await connection.client.query({
              query: `SHOW TABLES FROM ${database}`,
              format: 'JSONEachRow',
            })

            const rows = (await result.json()) as { name: string }[]
            const tables = rows.map((row) => row.name)

            await closeConnection(connection)

            return NextResponse.json({
              success: true,
              message: `Successfully connected to database '${database}'`,
              tables,
            })
          } else if (testType === 'table' && database && requestBody.table) {
            // Test table access
            const result = await connection.client.query({
              query: `SELECT * FROM ${database}.${requestBody.table} LIMIT 1`,
              format: 'JSONEachRow',
            })

            const rows = await result.json()

            await closeConnection(connection)

            return NextResponse.json({
              success: true,
              message: `Successfully accessed table '${requestBody.table}' in database '${database}'`,
              sample: rows,
            })
          } else {
            await closeConnection(connection)
            return NextResponse.json({
              success: false,
              error: `Invalid test type: ${testType}`,
            })
          }
        } catch (error) {
          await closeConnection(connection)
          throw error
        }
      } else {
        throw new Error('Invalid connection configuration')
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to ClickHouse server',
      })
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 },
    )
  }
}
