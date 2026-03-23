import { NextResponse } from 'next/server'
import { structuredLogger } from '@/src/observability'

export async function POST(request: Request) {
  try {
    const { url, apiKey, apiSecret, subject } = await request.json()

    if (!url?.trim()) {
      return NextResponse.json({ success: false, error: 'Registry URL is required' }, { status: 400 })
    }
    if (!subject?.trim()) {
      return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 })
    }

    const versionsUrl = `${url.replace(/\/$/, '')}/subjects/${encodeURIComponent(subject)}/versions`
    const headers: Record<string, string> = {}

    if (apiKey && apiSecret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`
    } else if (apiKey) {
      headers['Authorization'] = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`
    }

    const response = await fetch(versionsUrl, { headers })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return NextResponse.json({
        success: false,
        error: `Registry returned ${response.status}: ${text || response.statusText}`,
      })
    }

    const versionNumbers: number[] = await response.json()
    // Newest first, with label indicating which is newest
    const sorted = [...versionNumbers].sort((a, b) => b - a)
    const versions = sorted.map((v, idx) => ({
      version: v,
      label: idx === 0 ? `${v} (newest)` : String(v),
    }))

    return NextResponse.json({ success: true, versions })
  } catch (error) {
    structuredLogger.error('Schema registry versions fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
