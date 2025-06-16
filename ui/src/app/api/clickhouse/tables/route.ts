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
      useSSL = true,
      secure,
      connectionType,
      proxyUrl,
      connectionString,
      database,
    } = requestBody

    if (!database) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database name is required',
        },
        { status: 400 },
      )
    }

    let client

    // Create client based on connection type
    if (connectionType === 'connectionString' && connectionString) {
      client = createClient({
        url: connectionString,
      })
    } else if (connectionType === 'proxy' && proxyUrl) {
      client = createClient({
        url: proxyUrl,
        username,
        password,
      })
    } else {
      // Direct connection - use URL format
      // Properly extract hostname from URL
      const urlObj = new URL(generateHost({ host, port, username, password, useSSL, nativePort }))
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
          // Get tables with direct fetch
          const testUrl = `${useSSL ? 'https' : 'http'}://${cleanHost}:${port}/?query=${encodeURIComponent(`SHOW TABLES FROM ${database} FORMAT TabSeparated`)}`
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
            const tables = data
              .trim()
              .split('\n')
              .filter((table) => table.trim() !== '')

            if (tables.length === 0) {
              return NextResponse.json({
                success: true,
                tables: [],
                message: `Database '${database}' contains no tables`,
              })
            }

            return NextResponse.json({
              success: true,
              tables,
            })
          } else {
            const errorText = await response.text()
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
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
    }

    // This will only execute for HTTP connections or proxy/connectionString
    if (client) {
      try {
        // Get available tables
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
          tables,
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : `Failed to fetch tables for database '${database}'`,
        })
      }
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

  // Fallback return (should not reach here)
  return NextResponse.json(
    {
      success: false,
      error: 'Invalid connection configuration',
    },
    { status: 400 },
  )
}
