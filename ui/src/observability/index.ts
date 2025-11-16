/**
 * Observability module for Glassflow UI
 * Provides OpenTelemetry logging and metrics compatible with glassflow-api
 */

export { configureLogger, structuredLogger, shutdownLogger } from './logger'
export { configureMetrics, metricsRecorder, getUIMetrics, shutdownMetrics } from './metrics'
export { buildResourceAttributes } from './resource'
export { loadObservabilityConfig, observabilityConfig } from './config'
export type { ObservabilityConfig } from './config'
export type { LogAttributes } from './logger'

import { configureLogger } from './logger'
import { configureMetrics } from './metrics'
import { observabilityConfig } from './config'

/**
 * Initialize observability (logs and metrics)
 * Call this once when the application starts
 */
export function initializeObservability() {
  const config = observabilityConfig

  console.log('[Observability] Initializing with config:', {
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    logsEnabled: config.logsEnabled,
    metricsEnabled: config.metricsEnabled,
    otlpEndpoint: config.otlpEndpoint,
  })

  // Initialize logger
  if (config.logsEnabled) {
    configureLogger(config)
  }

  // Initialize metrics
  if (config.metricsEnabled) {
    configureMetrics(config)
  }
}

/**
 * Shutdown observability and flush all pending data
 * Call this during application cleanup
 */
export async function shutdownObservability() {
  const { shutdownLogger } = await import('./logger')
  const { shutdownMetrics } = await import('./metrics')

  await Promise.all([shutdownLogger(), shutdownMetrics()])

  console.log('[Observability] Shutdown complete')
}
