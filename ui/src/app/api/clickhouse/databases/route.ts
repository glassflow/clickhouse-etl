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
    } = requestBody

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
      console.log('Fetching databases from ClickHouse...')
      // Get available databases
      const result = await client.query({
        query: 'SHOW DATABASES',
        format: 'JSONEachRow',
      })

      const rows = (await result.json()) as { name: string }[]
      const databases = rows.map((row) => row.name)
      console.log('Successfully fetched databases:', databases)

      // Close the connection
      await client.close()
      console.log('Connection closed')

      return NextResponse.json({
        success: true,
        databases,
      })
    } catch (error) {
      console.error('Error fetching databases:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch databases',
      })
    }
  } catch (error) {
    console.error('Error in database API:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 },
    )
  }
}
