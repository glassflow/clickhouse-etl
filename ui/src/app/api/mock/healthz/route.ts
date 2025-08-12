import { NextResponse } from 'next/server'

export async function GET() {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Simulate 90% success rate for realistic testing
  const isHealthy = Math.random() > 0.1

  if (isHealthy) {
    // Simulate the real backend's simple 200 OK response
    return new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } else {
    // Simulate backend failure
    return new Response('Service Unavailable', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  }
}
