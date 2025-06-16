import { NextResponse } from 'next/server'
import { createClient } from '@clickhouse/client'
import { generateHost } from '@/src/utils/common.server'
import { Agent } from 'undici'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const requestBody = await request.json()

    const {
      host,
      port,
      nativePort,
      username,
      password,
      database,
      useSSL = true,
      secure,
      connectionType,
      proxyUrl,
      connectionString,
      testType = 'connection',
    } = requestBody

    let client

    // Create client based on connection type
    if (connectionType === 'connectionString' && connectionString) {
      // Use connection string directly
      client = createClient({
        url: connectionString,
      })
    } else if (connectionType === 'proxy' && proxyUrl) {
      // Connect via proxy
      client = createClient({
        url: proxyUrl,
        username,
        password,
        database: testType !== 'connection' ? database : undefined,
      })
    } else {
      // Generate host URL first
      const hostUrl = generateHost({ host, port, username, password, useSSL, nativePort })

      try {
        // Properly extract hostname from URL
        const urlObj = new URL(hostUrl)
        const cleanHost = urlObj.hostname

        // URL encode the username and password to handle special characters
        const encodedUsername = encodeURIComponent(username)
        const encodedPassword = encodeURIComponent(password)
        // Only use cleanHost without adding the protocol again
        const url = `${useSSL ? 'https' : 'http'}://${encodedUsername}:${encodedPassword}@${cleanHost}:${port}`

        // Always create undici dispatcher to skip certificate verification for SSL connections
        const dispatcher = new Agent({
          connect: {
            rejectUnauthorized: false, // Always skip cert verification
          },
        })

        // Always use direct HTTP for SSL connections (certificate verification always skipped)
        if (useSSL) {
          try {
            // Test connection with direct fetch
            const testUrl = `${useSSL ? 'https' : 'http'}://${cleanHost}:${port}/?query=${encodeURIComponent('SHOW DATABASES')}`
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
              const data = await response.text()
              const databases = data.trim().split('\n')

              return NextResponse.json({
                success: true,
                message: 'Successfully connected to ClickHouse',
                databases,
                method: 'direct-http',
              })
            } else {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
          } catch (directError) {
            return NextResponse.json({
              success: false,
              error: `Connection failed: ${directError instanceof Error ? directError.message : String(directError)}`,
            })
          }
        } else {
          // Use ClickHouse client for HTTP (non-SSL) connections
          client = createClient({
            url,
            request_timeout: 30000,
            keep_alive: {
              enabled: true,
              idle_socket_ttl: 25000,
            },
          })
        }
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Invalid URL construction: ' + (error instanceof Error ? error.message : String(error)),
        })
      }
    }

    // Test the connection
    try {
      const pingResult = await client.ping()

      // If we're just testing the connection, we can stop here
      if (testType === 'connection') {
        // Get available databases
        let databases: string[] = []
        try {
          const result = await client.query({
            query: 'SHOW DATABASES',
            format: 'JSONEachRow',
            // @ts-expect-error - FIXME: fix this
            request_timeout: 10000, // 10 seconds for database fetch
          })

          const rows = (await result.json()) as { name: string }[]
          databases = rows.map((row) => row.name)
        } catch (error) {
          // Close the connection first
          await client.close()
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch databases',
          })
        }

        // Close the connection
        await client.close()

        return NextResponse.json({
          success: true,
          message: 'Successfully connected to ClickHouse',
          databases,
        })
      }

      // If we're testing database access, we need a database name
      if (testType === 'database' && database) {
        try {
          // Test if we can access the specified database
          const result = await client.query({
            query: `SHOW TABLES FROM ${database}`,
            format: 'JSONEachRow',
          })

          const rows = (await result.json()) as { name: string }[]
          const tables = rows.map((row) => row.name)

          // Close the connection
          await client.close()

          return NextResponse.json({
            success: true,
            message: `Successfully connected to database '${database}'`,
            tables,
          })
        } catch (error) {
          console.error(`Error accessing database '${database}':`, error)
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : `Failed to access database '${database}'`,
          })
        }
      }

      // If we're testing table access, we need both database and table names
      if (testType === 'table' && database && requestBody.table) {
        try {
          // Test if we can access the specified table
          const result = await client.query({
            query: `SELECT * FROM ${database}.${requestBody.table} LIMIT 1`,
            format: 'JSONEachRow',
          })

          const rows = await result.json()

          // Close the connection
          await client.close()

          return NextResponse.json({
            success: true,
            message: `Successfully accessed table '${requestBody.table}' in database '${database}'`,
            sample: rows,
          })
        } catch (error) {
          console.error(`Error accessing table '${requestBody.table}' in database '${database}':`, error)
          return NextResponse.json({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : `Failed to access table '${requestBody.table}' in database '${database}'`,
          })
        }
      }

      // If we get here, something went wrong with the test type
      return NextResponse.json({
        success: false,
        error: `Invalid test type: ${testType}`,
      })
    } catch (error) {
      console.error('Error pinging ClickHouse:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to ClickHouse server',
      })
    }
  } catch (error) {
    console.error('Error testing ClickHouse connection:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 },
    )
  }
}
