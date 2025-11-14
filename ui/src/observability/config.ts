/**
 * Observability configuration for the UI application
 * Matches the structure from glassflow-api/pkg/observability/config.go
 */

import { getRuntimeEnv } from '@/src/utils/common.client'

export interface ObservabilityConfig {
  // Logging configuration
  logLevel: 'debug' | 'info' | 'warn' | 'error'

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
 * Load observability configuration from environment variables
 */
export function loadObservabilityConfig(): ObservabilityConfig {
  const env = getRuntimeEnv()

  const config: ObservabilityConfig = {
    logLevel: (env.NEXT_PUBLIC_LOG_LEVEL as any) || 'info',
    logsEnabled: env.NEXT_PUBLIC_OTEL_LOGS_ENABLED === 'true',
    metricsEnabled: env.NEXT_PUBLIC_OTEL_METRICS_ENABLED === 'true',
    serviceName: env.NEXT_PUBLIC_OTEL_SERVICE_NAME || 'glassflow-ui',
    serviceVersion: env.NEXT_PUBLIC_OTEL_SERVICE_VERSION || 'dev',
    serviceNamespace: env.NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE || '',
    serviceInstanceId: env.NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID || '',
    otlpEndpoint: env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    otlpHeaders: env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS)
      : undefined,
  }

  console.log('[Observability] Loaded config:', config)

  return config
}

/**
 * Default configuration instance
 */
export const observabilityConfig = loadObservabilityConfig()
