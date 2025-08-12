import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function POST(request: Request) {
  try {
    const config = await request.json()

    console.log('Pipeline API route - received config:', JSON.stringify(config, null, 2))

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

    console.log('Pipeline API route - sending to backend:', JSON.stringify(config, null, 2))
    const response = await axios.post(`${API_URL}/pipeline`, config)

    console.log('Pipeline API route - backend response:', JSON.stringify(response.data, null, 2))

    return NextResponse.json({
      success: true,
      pipeline_id: response.data.pipeline_id,
      status: 'active',
    })
  } catch (error: any) {
    console.error('API Route - Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config,
    })

    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Failed to create pipeline - route',
        },
        { status },
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create pipeline - route - no error object',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    console.log('Pipeline API route - fetching pipelines from backend')
    const response = await axios.get(`${API_URL}/pipeline`)

    console.log('Pipeline API route - backend returned pipelines:', JSON.stringify(response.data, null, 2))

    return NextResponse.json({
      success: true,
      pipelines: response.data,
    })
  } catch (error: any) {
    console.error('API Route - Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config,
    })

    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Failed to get pipelines',
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get pipelines',
      },
      { status: 500 },
    )
  }
}

// DELETE method is handled by /api/pipeline/[id]/route.ts for individual pipeline shutdown
// This route only handles GET (list all pipelines) and POST (create pipeline)
