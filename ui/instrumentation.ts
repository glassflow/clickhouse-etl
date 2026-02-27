/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Initializes the OTEL logger for server-side code (API routes, Kafka utilities).
 * Client-side initialization is handled by ObservabilityProvider in app/layout.tsx.
 *
 * The NEXT_RUNTIME guard is required: OTel packages use Node.js APIs that are
 * unavailable in the Edge runtime, causing silent import failures without it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { configureLogger } = await import('./src/observability/logger')
      const { loadObservabilityConfig } = await import('./src/observability/config')
      configureLogger(loadObservabilityConfig())
    } catch (error) {
      console.error('[Observability] Failed to initialize instrumentation:', error)
    }
  }
}
