import { NextResponse } from 'next/server'
import { createClient } from '@clickhouse/client'
import { generateHost } from '@/src/utils/common.server'
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
      // Direct connection - use URL format
      // Add more detailed logging
      console.log('Input data for URL generation:', {
        host,
        port,
        username: username ? 'provided' : 'not provided',
        password: password ? 'provided' : 'not provided',
        useSSL,
        nativePort,
      })

      // Generate host URL first
      const hostUrl = generateHost({ host, port, username, password, useSSL, nativePort })
      console.log('Generated host URL:', hostUrl)

      try {
        // Properly extract hostname from URL
        const urlObj = new URL(hostUrl)
        const cleanHost = urlObj.hostname
        console.log('Extracted clean hostname:', cleanHost)

        // URL encode the username and password to handle special characters
        const encodedUsername = encodeURIComponent(username)
        const encodedPassword = encodeURIComponent(password)
        // Only use cleanHost without adding the protocol again
        const url = `${useSSL ? 'https' : 'http'}://${encodedUsername}:${encodedPassword}@${cleanHost}:${port}`

        console.log(
          'Final ClickHouse connection URL structure:',
          url.replace(encodedPassword, '****').replace(encodedUsername, '****username****'),
        ) // Log URL structure with masked credentials

        console.log('ClickHouse connection config:', {
          useSSL,
          secure,
          cleanHost,
          port,
          hasUsername: !!username,
          hasPassword: !!password,
        })

        const tls = host.includes('https')
          ? ({
              rejectUnauthorized: false,
              servername: cleanHost,
            } as any)
          : undefined

        client = createClient({
          url,
          tls,
          request_timeout: 30000, // 30 seconds timeout
          keep_alive: {
            enabled: true,
            idle_socket_ttl: 25000, // 25 seconds
          },
        })
      } catch (error) {
        console.error('Error constructing URL:', error)
        return NextResponse.json({
          success: false,
          error: 'Invalid URL construction: ' + (error instanceof Error ? error.message : String(error)),
        })
      }
    }

    // Test the connection
    try {
      console.log('Testing connection to ClickHouse...')
      const pingResult = await client.ping()
      console.log('Ping result - clickhouse:', pingResult)

      // If we're just testing the connection, we can stop here
      if (testType === 'connection') {
        console.log('Fetching databases...')
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
          console.log('Successfully fetched databases:', databases)
        } catch (error) {
          console.error('Error fetching databases: - this failed', error)
          // Close the connection first
          await client.close()
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch databases',
          })
        }

        // Close the connection
        await client.close()
        console.log('Connection closed')

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
