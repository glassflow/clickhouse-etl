import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'
import { deleteNotificationsBulk } from '../../mock/data/notifications-state'

/**
 * POST /ui-api/notifications/delete-bulk
 * Proxy to notification service: POST /api/notifications/delete-bulk
 * Soft delete multiple notifications
 */
export async function POST(request: NextRequest) {
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

      const result = deleteNotificationsBulk(notificationIds)

      return NextResponse.json({
        message: `Deleted ${result.deletedCount} notification(s)`,
        deleted_count: result.deletedCount,
        requested_count: notificationIds.length,
        ...(result.notFound.length > 0 && { not_found: result.notFound }),
      })
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to delete notifications' },
        { status: 400 },
      )
    }
  }

  try {
    const body = await request.json()
    const url = `${runtimeConfig.notifierUrl}/api/notifications/delete-bulk`

    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to delete notifications with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
