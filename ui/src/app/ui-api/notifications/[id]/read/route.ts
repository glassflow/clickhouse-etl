import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /ui-api/notifications/[id]/read
 * Proxy to notification service: PATCH /api/notifications/{notification_id}/read
 * Mark a single notification as read
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  const { id } = await params

  try {
    const url = `${runtimeConfig.notifierUrl}/api/notifications/${id}/read`
    const response = await axios.patch(url, {}, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to mark notification as read with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
