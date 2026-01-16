import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'

/**
 * GET /ui-api/notifications/severity-mappings
 * Proxy to notification service: GET /api/severity-mappings
 * Get all severity-to-channel mappings
 */
export async function GET(request: NextRequest) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  try {
    const url = `${runtimeConfig.notifierUrl}/api/severity-mappings`
    const response = await axios.get(url, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to fetch severity mappings with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}

/**
 * PUT /ui-api/notifications/severity-mappings
 * Proxy to notification service: PUT /api/severity-mappings
 * Bulk update all severity mappings
 */
export async function PUT(request: NextRequest) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const url = `${runtimeConfig.notifierUrl}/api/severity-mappings`

    const response = await axios.put(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to update severity mappings with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
