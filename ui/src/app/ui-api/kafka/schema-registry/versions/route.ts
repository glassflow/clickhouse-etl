import { NextResponse } from 'next/server'
import { buildRegistryAuthHeaders } from '../_auth'
import { structuredLogger } from '@/src/observability'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, authMethod, apiKey, apiSecret, username, password, subject } = body

    if (!url?.trim()) {
      return NextResponse.json({ success: false, error: 'Registry URL is required' }, { status: 400 })
    }
    if (!subject?.trim()) {
      return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 })
    }

    const versionsUrl = `${url.replace(/\/$/, '')}/subjects/${encodeURIComponent(subject)}/versions`
    const headers = buildRegistryAuthHeaders({ authMethod, apiKey, apiSecret, username, password })

    const response = await fetch(versionsUrl, { headers })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return NextResponse.json({
        success: false,
        error: `Registry returned ${response.status}: ${text || response.statusText}`,
      })
    }

    const versionNumbers: number[] = await response.json()
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
