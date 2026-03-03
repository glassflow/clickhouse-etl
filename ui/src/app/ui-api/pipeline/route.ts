import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'
import { structuredLogger } from '@/src/observability'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function POST(request: Request) {
  try {
    const config = await request.json()

    // Normalize Kafka broker hosts for Docker backend: localhost/127.0.0.1 -> host.docker.internal
    if (config?.source?.connection_params?.brokers && Array.isArray(config.source.connection_params.brokers)) {
      config.source.connection_params.brokers = config.source.connection_params.brokers.map((b: string) => {
        if (!b) return b
        const [host, port] = b.split(':')
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
        return isLocal ? `host.docker.internal${port ? `:${port}` : ''}` : b
      })
    }

    // Safety: Backend ClickHouse client uses the native protocol on sink.port.
    // If a client mistakenly sends HTTP port and a separate native_port, prefer native_port for backend.
    if (config?.sink?.native_port) {
      config.sink.port = String(config.sink.native_port)
      // Do not forward native_port as backend schema does not include it
      delete config.sink.native_port
    }

    const response = await axios.post(`${API_URL}/pipeline`, config)

    return NextResponse.json({
      success: true,
      pipeline: {
        pipeline_id: response.data.pipeline_id,
        status: 'active',
        ...response.data,
      },
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response
      const message = getBackendErrorMessage(data, 'Failed to create pipeline')
      structuredLogger.error('Pipeline POST backend error', { status, data: typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data) })
      return NextResponse.json({ success: false, error: message }, { status })
    }
    // Network/connection error (e.g. ECONNREFUSED when backend not running or wrong API_URL)
    const message = error instanceof Error ? error.message : 'Unknown error'
    structuredLogger.error('Pipeline POST backend unreachable', { error: message })
    return NextResponse.json(
      { success: false, error: `Backend unreachable: ${message}. Check API_URL and that the pipeline API is running.` },
      { status: 500 },
    )
  }
}

function getBackendErrorMessage(data: unknown, fallback: string): string {
  if (data === null || data === undefined) return fallback
  if (typeof data === 'string') return data || fallback
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.detail === 'string') return obj.detail
    if (obj.detail && typeof obj.detail === 'object' && typeof (obj.detail as { msg?: string }).msg === 'string')
      return (obj.detail as { msg: string }).msg
  }
  return fallback
}

export async function GET() {
  try {
    const response = await axios.get(`${API_URL}/pipeline`)

    return NextResponse.json({
      success: true,
      pipelines: response.data,
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response
      const message = getBackendErrorMessage(data, 'Failed to get pipelines')
      structuredLogger.error('Pipeline GET backend error', { status, data: typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data) })
      return NextResponse.json({ success: false, error: message }, { status })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    structuredLogger.error('Pipeline GET backend unreachable', { error: message })
    return NextResponse.json(
      { success: false, error: `Backend unreachable: ${message}. Check API_URL and that the pipeline API is running.` },
      { status: 500 },
    )
  }
}

// DELETE method is handled by /ui-api/pipeline/[id]/route.ts for individual pipeline shutdown
// This route only handles GET (list all pipelines) and POST (create pipeline)
