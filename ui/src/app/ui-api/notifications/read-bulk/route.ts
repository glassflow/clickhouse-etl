import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'

/**
 * PATCH /ui-api/notifications/read-bulk
 * Proxy to notification service: PATCH /api/notifications/read-bulk
 * Mark multiple notifications as read
 */
export async function PATCH(request: NextRequest) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
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
