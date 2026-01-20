import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'
import {
  getSeverityMapping,
  updateSeverityMapping,
  deleteSeverityMapping,
} from '../../../mock/data/notifications-state'
import type { SeverityLevel, ChannelType } from '@/src/services/notifications-api'

interface RouteParams {
  params: Promise<{ severity: string }>
}

/**
 * GET /ui-api/notifications/severity-mappings/[severity]
 * Proxy to notification service: GET /api/severity-mappings/{severity}
 * Get a specific severity mapping
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const { severity } = await params

  if (useMockApi) {
    const mapping = getSeverityMapping(severity as SeverityLevel)
    if (!mapping) {
      return NextResponse.json({ error: 'Severity mapping not found' }, { status: 404 })
    }
    return NextResponse.json(mapping)
  }

  try {
    const url = `${runtimeConfig.notifierUrl}/api/severity-mappings/${severity}`
    const response = await axios.get(url, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to fetch severity mapping with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}

/**
 * PUT /ui-api/notifications/severity-mappings/[severity]
 * Proxy to notification service: PUT /api/severity-mappings/{severity}
 * Create or update a severity mapping
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const { severity } = await params

  if (useMockApi) {
    try {
      const body = await request.json()
      const channels = body.channels || []

      if (!Array.isArray(channels)) {
        return NextResponse.json(
          { error: 'channels must be an array' },
          { status: 400 },
        )
      }

      const result = updateSeverityMapping(severity as SeverityLevel, channels as ChannelType[])

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Severity mapping not found' },
          { status: 404 },
        )
      }

      return NextResponse.json(result.mapping)
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to update severity mapping' },
        { status: 400 },
      )
    }
  }

  try {
    const body = await request.json()
    const url = `${runtimeConfig.notifierUrl}/api/severity-mappings/${severity}`

    const response = await axios.put(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to update severity mapping with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}

/**
 * DELETE /ui-api/notifications/severity-mappings/[severity]
 * Proxy to notification service: DELETE /api/severity-mappings/{severity}
 * Delete a severity mapping
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const { severity } = await params

  if (useMockApi) {
    const result = deleteSeverityMapping(severity as SeverityLevel)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Severity mapping not found' },
        { status: 404 },
      )
    }
    return new NextResponse(null, { status: 204 })
  }

  try {
    const url = `${runtimeConfig.notifierUrl}/api/severity-mappings/${severity}`
    await axios.delete(url, {
      timeout: 10000,
    })

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        { error: data?.error || `Failed to delete severity mapping with status ${status}` },
        { status },
      )
    }

    return NextResponse.json({ error: 'Notification service is not responding' }, { status: 503 })
  }
}
