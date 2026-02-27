/**
 * Observability configuration for the UI application
 * Matches the structure from glassflow-api/pkg/observability/config.go
 */

export interface ObservabilityConfig {
  // Logging configuration
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  consoleLogsEnabled: boolean

  // OpenTelemetry configuration
  logsEnabled: boolean
  metricsEnabled: boolean
  serviceName: string
  serviceVersion: string
  serviceNamespace: string
  serviceInstanceId: string

  // OTLP Exporter configuration
  otlpEndpoint: string
  otlpHeaders?: Record<string, string>
}

/**
 * Read an env variable from window.__ENV__ (client) or process.env (server).
 * NEXT_PUBLIC_* vars are available in process.env on both server and client.
 */
function getEnvVar(key: string): string | undefined {
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    const val = (window as any).__ENV__[key]
    if (val !== undefined) return val
  }
  return process.env[key]
}

/**
 * Load observability configuration from environment variables.
 * Works on both server (API routes, instrumentation.ts) and client.
 */
export function loadObservabilityConfig(): ObservabilityConfig {
  const headersRaw = getEnvVar('NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS')

  const config: ObservabilityConfig = {
    logLevel: (getEnvVar('NEXT_PUBLIC_LOG_LEVEL') as ObservabilityConfig['logLevel']) || 'info',
    consoleLogsEnabled: getEnvVar('NEXT_PUBLIC_OTEL_CONSOLE_LOGS_ENABLED') !== 'false',
    logsEnabled: getEnvVar('NEXT_PUBLIC_OTEL_LOGS_ENABLED') === 'true',
    metricsEnabled: getEnvVar('NEXT_PUBLIC_OTEL_METRICS_ENABLED') === 'true',
    serviceName: getEnvVar('NEXT_PUBLIC_OTEL_SERVICE_NAME') || 'glassflow-ui',
    serviceVersion: getEnvVar('NEXT_PUBLIC_OTEL_SERVICE_VERSION') || 'dev',
    serviceNamespace: getEnvVar('NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE') || '',
    serviceInstanceId: getEnvVar('NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID') || '',
    otlpEndpoint: getEnvVar('NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT') || 'http://localhost:4318',
    otlpHeaders: headersRaw ? JSON.parse(headersRaw) : undefined,
  }

  console.log('[Observability] Loaded config:', config)

  return config
}

/**
 * Default configuration instance
 */
export const observabilityConfig = loadObservabilityConfig()
