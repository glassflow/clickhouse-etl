import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'

interface RouteParams {
  params: Promise<{ type: string }>
}

/**
 * GET /ui-api/notifications/channels/[type]
 * Proxy to notification service: GET /api/channels/{channel_type}
 * Get a specific channel configuration
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  const { type } = await params

  try {
    const url = `${runtimeConfig.notifierUrl}/api/channels/${type}`
    const response = await axios.get(url, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to fetch channel with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}

/**
 * PUT /ui-api/notifications/channels/[type]
 * Proxy to notification service: PUT /api/channels/{channel_type}
 * Create or update a channel configuration
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  const { type } = await params

  try {
    const body = await request.json()
    const url = `${runtimeConfig.notifierUrl}/api/channels/${type}`

    const response = await axios.put(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to update channel with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}

/**
 * DELETE /ui-api/notifications/channels/[type]
 * Proxy to notification service: DELETE /api/channels/{channel_type}
 * Delete a channel configuration
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  const { type } = await params

  try {
    const url = `${runtimeConfig.notifierUrl}/api/channels/${type}`
    await axios.delete(url, {
      timeout: 10000,
    })

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to delete channel with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
