import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'

/**
 * POST /ui-api/notifications/delete-bulk
 * Proxy to notification service: POST /api/notifications/delete-bulk
 * Soft delete multiple notifications
 */
export async function POST(request: NextRequest) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
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
