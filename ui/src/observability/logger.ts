/**
 * Logger module with OpenTelemetry OTLP exporter
 * Matches glassflow-api/pkg/observability/logger.go
 */

import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { LoggerProvider, BatchLogRecordProcessor, ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import type { ObservabilityConfig } from './config'
import { buildResourceAttributes } from './resource'

let loggerProvider: LoggerProvider | null = null
let logger: ReturnType<typeof logs.getLogger> | null = null
let lazyInitPromise: Promise<void> | null = null
const PENDING_QUEUE_MAX = 50
const pendingLogs: Array<{ level: string; message: string; attributes?: LogAttributes }> = []

/**
 * Configure logger with OpenTelemetry OTLP exporter
 */
export function configureLogger(config: ObservabilityConfig): void {
  if (!config.logsEnabled) {
    console.log('[Observability] Logs are disabled')
    return
  }

  try {
    // Create resource with service information
    const resource = buildResourceAttributes(config)

    // Create OTLP HTTP exporter
    const otlpExporter = new OTLPLogExporter({
      url: `${config.otlpEndpoint}/v1/logs`,
      headers: config.otlpHeaders,
    })

    // Create log processor and provider
    const logRecordProcessor = new BatchLogRecordProcessor(otlpExporter, {
      maxQueueSize: 100,
      maxExportBatchSize: 10,
      scheduledDelayMillis: 1000,
    })

    // Create logger provider with resource and processor
    loggerProvider = new LoggerProvider({
      resource,
    })

    loggerProvider.addLogRecordProcessor(logRecordProcessor)

    // Also add console exporter for local debugging
    if (config.logLevel === 'debug') {
      const consoleExporter = new ConsoleLogRecordExporter()
      const consoleProcessor = new BatchLogRecordProcessor(consoleExporter)
      loggerProvider.addLogRecordProcessor(consoleProcessor)
    }

    // Set global logger provider
    logs.setGlobalLoggerProvider(loggerProvider)

    // Get logger instance
    logger = logs.getLogger(config.serviceName, config.serviceVersion)

    console.log('[Observability] Logger configured with OTLP exporter:', config.otlpEndpoint)
    flushPendingLogs()
  } catch (error) {
    console.error('[Observability] Failed to configure logger:', error)
  }
}

/**
 * Flush logs that were queued before the logger was ready (lazy init)
 */
function flushPendingLogs(): void {
  while (pendingLogs.length > 0 && logger) {
    const entry = pendingLogs.shift()!
    logger.emit({
      severityNumber: severityMap[entry.level] || SeverityNumber.INFO,
      severityText: entry.level.toUpperCase(),
      body: entry.message,
      attributes: entry.attributes || {},
      timestamp: Date.now(),
    })
  }
}

/**
 * Severity level mapping
 */
const severityMap: Record<string, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
}

/**
 * Structured logger interface matching slog pattern from Go API
 */
export interface LogAttributes {
  [key: string]: string | number | boolean | undefined
}

export const structuredLogger = {
  debug: (message: string, attributes?: LogAttributes) => {
    emitLog('debug', message, attributes)
    if (observabilityConfig.consoleLogsEnabled && observabilityConfig.logLevel === 'debug') {
      console.debug(`[DEBUG] ${message}`, attributes || {})
    }
  },

  info: (message: string, attributes?: LogAttributes) => {
    emitLog('info', message, attributes)
    if (observabilityConfig.consoleLogsEnabled) {
      console.info(`[INFO] ${message}`, attributes || {})
    }
  },

  warn: (message: string, attributes?: LogAttributes) => {
    emitLog('warn', message, attributes)
    if (observabilityConfig.consoleLogsEnabled) {
      console.warn(`[WARN] ${message}`, attributes || {})
    }
  },

  error: (message: string, attributes?: LogAttributes) => {
    emitLog('error', message, attributes)
    if (observabilityConfig.consoleLogsEnabled) {
      console.error(`[ERROR] ${message}`, attributes || {})
    }
  },

  /**
   * Create a child logger with additional attributes
   */
  with: (contextAttributes: LogAttributes) => {
    return {
      debug: (message: string, attributes?: LogAttributes) => {
        structuredLogger.debug(message, { ...contextAttributes, ...attributes })
      },
      info: (message: string, attributes?: LogAttributes) => {
        structuredLogger.info(message, { ...contextAttributes, ...attributes })
      },
      warn: (message: string, attributes?: LogAttributes) => {
        structuredLogger.warn(message, { ...contextAttributes, ...attributes })
      },
      error: (message: string, attributes?: LogAttributes) => {
        structuredLogger.error(message, { ...contextAttributes, ...attributes })
      },
    }
  },
}

/**
 * Lazy-init logger on first use (fallback when instrumentation.ts does not run, e.g. standalone).
 * Server-only; no-op on client.
 */
function ensureLoggerConfigured(): void {
  if (typeof window !== 'undefined') return
  if (logger !== null || lazyInitPromise !== null) return
  lazyInitPromise = (async () => {
    try {
      const { loadObservabilityConfig } = await import('./config')
      configureLogger(loadObservabilityConfig())
    } catch (err) {
      console.error('[Observability] Lazy init failed:', err)
    } finally {
      lazyInitPromise = null
    }
  })()
}

/**
 * Emit a log record to OpenTelemetry.
 * On server, if the logger is not yet configured (e.g. instrumentation did not run), logs are queued
 * and sent once lazy init completes.
 */
function emitLog(level: string, message: string, attributes?: LogAttributes) {
  if (typeof window === 'undefined' && logger === null) {
    if (pendingLogs.length < PENDING_QUEUE_MAX) {
      pendingLogs.push({ level, message, attributes })
    }
    ensureLoggerConfigured()
    return
  }
  if (!logger) {
    return
  }

  logger.emit({
    severityNumber: severityMap[level] || SeverityNumber.INFO,
    severityText: level.toUpperCase(),
    body: message,
    attributes: attributes || {},
    timestamp: Date.now(),
  })
}

/**
 * Shutdown logger and flush pending logs
 */
export async function shutdownLogger(): Promise<void> {
  if (loggerProvider) {
    await loggerProvider.shutdown()
    loggerProvider = null
    logger = null
  }
}

// Import config for console logging level check
import { observabilityConfig } from './config'
