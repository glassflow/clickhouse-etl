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
      table,
      useSSL = true,
      secure,
      connectionType,
      proxyUrl,
      connectionString,
    } = requestBody

    if (!database || !table) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database and table names are required',
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
        database,
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
          // Try different query approaches based on the database type
          let query: string

          if (database === 'information_schema') {
            // For information_schema, use standard SQL approach
            query = `SELECT column_name as name, data_type as type, is_nullable, column_default as default_expression FROM information_schema.columns WHERE table_schema = '${database}' AND table_name = '${table}' FORMAT JSONEachRow`
          } else if (database === 'system') {
            // For system database, use ClickHouse system tables
            query = `SELECT name, type, default_kind, default_expression FROM system.columns WHERE database = '${database}' AND table = '${table}' FORMAT JSONEachRow`
          } else {
            // For regular databases, use DESCRIBE TABLE
            query = `DESCRIBE TABLE \`${database}\`.\`${table}\` FORMAT JSONEachRow`
          }

          // Get table schema with direct fetch - format is now part of the query
          const testUrl = `${useSSL ? 'https' : 'http'}://${cleanHost}:${port}/?query=${encodeURIComponent(query)}`
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
            // Parse JSON lines format
            const columns = data
              .trim()
              .split('\n')
              .filter((line) => line.trim() !== '')
              .map((line) => {
                try {
                  return JSON.parse(line)
                } catch (parseError) {
                  console.error('Failed to parse line:', line, parseError)
                  return null
                }
              })
              .filter(Boolean)

            return NextResponse.json({
              success: true,
              columns,
            })
          } else {
            const errorText = await response.text()

            // Try fallback query for regular tables
            if (database !== 'information_schema' && database !== 'system') {
              const fallbackQuery = `DESCRIBE TABLE ${database}.${table} FORMAT JSONEachRow`
              const fallbackUrl = `${useSSL ? 'https' : 'http'}://${cleanHost}:${port}/?query=${encodeURIComponent(fallbackQuery)}`

              const fallbackResponse = await fetch(fallbackUrl, {
                method: 'GET',
                headers: {
                  Authorization: authHeader,
                },
                // @ts-expect-error - undici dispatcher not in standard fetch types
                dispatcher,
              })

              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.text()
                const columns = fallbackData
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

                return NextResponse.json({
                  success: true,
                  columns,
                })
              } else {
                const fallbackErrorText = await fallbackResponse.text()
                console.error(`Fallback query also failed for ${database}.${table}:`, fallbackErrorText)
              }
            }

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
        // Get table schema
        const result = await client.query({
          query: `DESCRIBE TABLE ${database}.${table}`,
          format: 'JSONEachRow',
        })

        const columns = await result.json()

        // Close the connection
        await client.close()

        return NextResponse.json({
          success: true,
          columns,
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : `Failed to fetch schema for table '${table}' in database '${database}'`,
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
