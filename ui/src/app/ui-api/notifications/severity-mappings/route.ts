import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'
import { getSeverityMappings, updateSeverityMappingsBulk } from '../../mock/data/notifications-state'
import type { SeverityLevel, ChannelType } from '@/src/services/notifications-api'

/**
 * GET /ui-api/notifications/severity-mappings
 * Proxy to notification service: GET /api/severity-mappings
 * Get all severity-to-channel mappings
 */
export async function GET(request: NextRequest) {
  if (!runtimeConfig.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications feature is disabled' }, { status: 403 })
  }

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  if (useMockApi) {
    const mappings = getSeverityMappings()
    return NextResponse.json({ mappings })
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

  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  if (useMockApi) {
    try {
      const body = await request.json()
      // Body should be an object mapping severity levels to channel types
      // e.g., { debug: [], info: ['slack'], warn: ['slack'], error: ['slack', 'email'], fatal: ['slack', 'email'] }
      const mappingsUpdate: Partial<Record<SeverityLevel, ChannelType[]>> = {}
      
      // Validate and convert body to the expected format
      for (const [severity, channels] of Object.entries(body)) {
        if (['debug', 'info', 'warn', 'error', 'fatal'].includes(severity)) {
          if (Array.isArray(channels)) {
            mappingsUpdate[severity as SeverityLevel] = channels as ChannelType[]
          }
        }
      }

      const updatedMappings = updateSeverityMappingsBulk(mappingsUpdate)
      return NextResponse.json({ mappings: updatedMappings })
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to update severity mappings' },
        { status: 400 },
      )
    }
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
