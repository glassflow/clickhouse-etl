import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'
import { getNotificationsFiltered } from '../mock/data/notifications-state'
import type { NotificationSeverity } from '@/src/services/notifications-api'

/**
 * GET /ui-api/notifications
 * Proxy to notification service: GET /api/notifications
 * List notifications with optional filters and pagination
 */
export async function GET(request: NextRequest) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  if (useMockApi) {
    try {
      const { searchParams } = new URL(request.url)

      // Parse query parameters
      const pipelineId = searchParams.get('pipeline_id') || undefined
      const severity = searchParams.get('severity') as NotificationSeverity | null
      const readStatus = searchParams.get('read_status') as 'read' | 'unread' | null
      const startDate = searchParams.get('start_date') || undefined
      const endDate = searchParams.get('end_date') || undefined
      const limit = parseInt(searchParams.get('limit') || '20', 10)
      const offset = parseInt(searchParams.get('offset') || '0', 10)
      const includeDeleted = searchParams.get('include_deleted') === 'true'

      const result = getNotificationsFiltered(
        {
          pipeline_id: pipelineId,
          severity: severity || undefined,
          read_status: readStatus || undefined,
          start_date: startDate,
          end_date: endDate,
          include_deleted: includeDeleted,
        },
        { limit, offset },
      )

      return NextResponse.json({
        notifications: result.notifications,
        pagination: {
          total: result.total,
          limit,
          offset,
          returned: result.notifications.length,
        },
        filters: {
          ...(pipelineId && { pipeline_id: pipelineId }),
          ...(severity && { severity }),
          ...(readStatus && { read_status: readStatus }),
          ...(startDate && { start_date: startDate }),
          ...(endDate && { end_date: endDate }),
        },
      })
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch notifications' },
        { status: 500 },
      )
    }
  }

  try {
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    const url = `${runtimeConfig.notifierUrl}/api/notifications${queryString ? `?${queryString}` : ''}`

    const response = await axios.get(url, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to fetch notifications with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
