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
      const url = `${useSSL ? 'https' : 'http'}://${encodedUsername}:${encodedPassword}@${cleanHost}:${port}`

      console.log('ClickHouse connection URL:', url.replace(encodedPassword, '****')) // Log URL with masked password
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
    }

    try {
      console.log(`Fetching tables from database '${database}'...`)
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
      console.error(`Error fetching tables for database '${database}':`, error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : `Failed to fetch tables for database '${database}'`,
      })
    }
  } catch (error) {
    console.error('Error in tables API:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 },
    )
  }
}
