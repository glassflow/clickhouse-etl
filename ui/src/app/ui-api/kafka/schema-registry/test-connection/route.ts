import { NextResponse } from 'next/server'
import { structuredLogger } from '@/src/observability'

export async function POST(request: Request) {
  try {
    const { url, apiKey, apiSecret } = await request.json()

    if (!url || !url.trim()) {
      return NextResponse.json({ success: false, message: 'Registry URL is required' }, { status: 400 })
    }

    const subjectsUrl = `${url.replace(/\/$/, '')}/subjects`
    const headers: Record<string, string> = {}

    if (apiKey && apiSecret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`
    } else if (apiKey) {
      headers['Authorization'] = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`
    }

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
