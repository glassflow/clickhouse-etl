import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'
import { markNotificationsAsReadBulk } from '../../mock/data/notifications-state'

/**
 * PATCH /ui-api/notifications/read-bulk
 * Proxy to notification service: PATCH /api/notifications/read-bulk
 * Mark multiple notifications as read
 */
export async function PATCH(request: NextRequest) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  if (useMockApi) {
    try {
      const body = await request.json()
      const notificationIds = body.notification_ids || []

      if (!Array.isArray(notificationIds)) {
        return NextResponse.json(
          { error: 'notification_ids must be an array' },
          { status: 400 },
        )
      }

      const result = markNotificationsAsReadBulk(notificationIds)

      return NextResponse.json({
        message: `Marked ${result.markedCount} notification(s) as read`,
        marked_count: result.markedCount,
        requested_count: notificationIds.length,
        ...(result.notFound.length > 0 && { not_found: result.notFound }),
      })
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to mark notifications as read' },
        { status: 400 },
      )
    }
  }

  try {
    const body = await request.json()
    const url = `${runtimeConfig.notifierUrl}/api/notifications/read-bulk`

    const response = await axios.patch(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to mark notifications as read with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
