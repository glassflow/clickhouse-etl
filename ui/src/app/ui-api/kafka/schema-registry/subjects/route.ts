import { NextResponse } from 'next/server'
import { structuredLogger } from '@/src/observability'

function rankSubjects(subjects: string[], topicName: string): string[] {
  const exact = `${topicName}-value`
  const key = `${topicName}-key`
  const contains: string[] = []
  const rest: string[] = []

  for (const s of subjects) {
    if (s === exact || s === key) continue
    if (s.includes(topicName)) {
      contains.push(s)
    } else {
      rest.push(s)
    }
  }

  const ranked: string[] = []
  if (subjects.includes(exact)) ranked.push(exact)
  if (subjects.includes(key)) ranked.push(key)
  ranked.push(...contains)
  ranked.push(...rest)
  return ranked
}

export async function POST(request: Request) {
  try {
    const { url, apiKey, apiSecret, topicName } = await request.json()

    if (!url?.trim()) {
      return NextResponse.json({ success: false, error: 'Registry URL is required' }, { status: 400 })
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
      return NextResponse.json({
        success: false,
        error: `Registry returned ${response.status}: ${text || response.statusText}`,
      })
    }

    const subjects: string[] = await response.json()
    const ranked = topicName ? rankSubjects(subjects, topicName) : subjects

    return NextResponse.json({ success: true, subjects: ranked })
  } catch (error) {
    structuredLogger.error('Schema registry subjects fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
