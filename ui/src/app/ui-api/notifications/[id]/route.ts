import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'
import { getNotification, deleteNotification } from '../../mock/data/notifications-state'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /ui-api/notifications/[id]
 * Proxy to notification service: GET /api/notifications/{notification_id}
 * Get a single notification by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const { id } = await params

  if (useMockApi) {
    const notification = getNotification(id)
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    return NextResponse.json(notification)
  }

  try {
    const url = `${runtimeConfig.notifierUrl}/api/notifications/${id}`
    const response = await axios.get(url, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to fetch notification with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}

/**
 * DELETE /ui-api/notifications/[id]
 * Proxy to notification service: DELETE /api/notifications/{notification_id}
 * Soft delete a single notification
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const { id } = await params

  if (useMockApi) {
    const result = deleteNotification(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Notification not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Notification deleted successfully' })
  }

  try {
    const url = `${runtimeConfig.notifierUrl}/api/notifications/${id}`
    const response = await axios.delete(url, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to delete notification with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
