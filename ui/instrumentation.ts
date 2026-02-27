/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Initializes the OTEL logger for server-side code (API routes, Kafka utilities).
 * Client-side initialization is handled by ObservabilityProvider in app/layout.tsx.
 */
export async function register() {
  const { configureLogger } = await import('./src/observability/logger')
  const { loadObservabilityConfig } = await import('./src/observability/config')
  configureLogger(loadObservabilityConfig())
}
