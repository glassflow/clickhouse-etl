import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'
import { getChannel, updateChannel, deleteChannel } from '../../../mock/data/notifications-state'
import type { ChannelType } from '@/src/services/notifications-api'

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

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const { type } = await params

  if (useMockApi) {
    const channel = getChannel(type as ChannelType)
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }
    return NextResponse.json(channel)
  }

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

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const { type } = await params

  if (useMockApi) {
    try {
      const body = await request.json()
      const result = updateChannel(type as ChannelType, {
        enabled: body.enabled,
        config: body.config,
      })

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Channel not found' },
          { status: 404 },
        )
      }

      return NextResponse.json(result.channel)
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to update channel' },
        { status: 400 },
      )
    }
  }

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

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const { type } = await params

  if (useMockApi) {
    const result = deleteChannel(type as ChannelType)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Channel not found' },
        { status: 404 },
      )
    }
    return new NextResponse(null, { status: 204 })
  }

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
