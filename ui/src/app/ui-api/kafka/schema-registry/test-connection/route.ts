import { NextResponse } from 'next/server'
import { buildRegistryAuthHeaders } from '../_auth'
import { structuredLogger } from '@/src/observability'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, authMethod, apiKey, apiSecret, username, password } = body

    if (!url || !url.trim()) {
      return NextResponse.json({ success: false, message: 'Registry URL is required' }, { status: 400 })
    }

    const subjectsUrl = `${url.replace(/\/$/, '')}/subjects`
    const headers = buildRegistryAuthHeaders({ authMethod, apiKey, apiSecret, username, password })

    const response = await fetch(subjectsUrl, { headers })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return NextResponse.json(
        { success: false, message: `Registry returned ${response.status}: ${text || response.statusText}` },
        { status: 200 },
      )
    }

    const subjects: string[] = await response.json()
    const subjectCount = Array.isArray(subjects) ? subjects.length : 0

    return NextResponse.json({
      success: true,
      message: `Connected — ${subjectCount} subject${subjectCount !== 1 ? 's' : ''} available`,
      subjectCount,
    })
  } catch (error) {
    structuredLogger.error('Schema registry test-connection failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 200 },
    )
  }
}
