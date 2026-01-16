import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'

interface RouteParams {
  params: Promise<{ severity: string }>
}

/**
 * GET /ui-api/notifications/severity-mappings/[severity]
 * Proxy to notification service: GET /api/severity-mappings/{severity}
 * Get a specific severity mapping
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  const { severity } = await params

  try {
    const url = `${runtimeConfig.notifierUrl}/api/severity-mappings/${severity}`
    const response = await axios.get(url, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to fetch severity mapping with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}

/**
 * PUT /ui-api/notifications/severity-mappings/[severity]
 * Proxy to notification service: PUT /api/severity-mappings/{severity}
 * Create or update a severity mapping
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  const { severity } = await params

  try {
    const body = await request.json()
    const url = `${runtimeConfig.notifierUrl}/api/severity-mappings/${severity}`

    const response = await axios.put(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to update severity mapping with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}

/**
 * DELETE /ui-api/notifications/severity-mappings/[severity]
 * Proxy to notification service: DELETE /api/severity-mappings/{severity}
 * Delete a severity mapping
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  const { severity } = await params

  try {
    const url = `${runtimeConfig.notifierUrl}/api/severity-mappings/${severity}`
    await axios.delete(url, {
      timeout: 10000,
    })

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to delete severity mapping with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
