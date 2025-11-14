/**
 * Metrics module with OpenTelemetry OTLP exporter
 * Matches glassflow-api/pkg/observability/meter.go
 */

import { metrics, ValueType, Counter, Histogram } from '@opentelemetry/api'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import type { ObservabilityConfig } from './config'
import { buildResourceAttributes } from './resource'

let meterProvider: MeterProvider | null = null
let meter: ReturnType<typeof metrics.getMeter> | null = null

/**
 * Metric prefix for Glassflow UI metrics
 */
export const GF_METRIC_PREFIX = 'gfm_ui'

/**
 * UI-specific metrics
 */
interface UIMetrics {
  // Page metrics
  pageViews: Counter
  pageLoadDuration: Histogram

  // User interaction metrics
  buttonClicks: Counter
  formSubmissions: Counter

  // API call metrics
  apiRequestCount: Counter
  apiRequestDuration: Histogram
  apiRequestErrors: Counter

  // Pipeline operations
  pipelineCreated: Counter
  pipelineDeleted: Counter
  pipelineStatusChanged: Counter
}

let uiMetrics: UIMetrics | null = null

/**
 * Configure metrics with OpenTelemetry OTLP exporter
 */
export function configureMetrics(config: ObservabilityConfig): void {
  if (!config.metricsEnabled) {
    console.log('[Observability] Metrics are disabled')
    return
  }

  try {
    // Create resource with service information
    const resource = buildResourceAttributes(config)

    // Create OTLP metrics exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${config.otlpEndpoint}/v1/metrics`,
      headers: config.otlpHeaders,
    })

    // Create periodic reader that exports every 10 seconds
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000, // 10 seconds, matching Go API
    })

    // Create MeterProvider with resource and reader
    meterProvider = new MeterProvider({
      resource,
      readers: [metricReader],
    })

    // Set global meter provider
    metrics.setGlobalMeterProvider(meterProvider)

    // Get meter instance
    meter = metrics.getMeter('glassflow-ui', config.serviceVersion)

    // Initialize UI metrics
    uiMetrics = createUIMetrics()

    console.log('[Observability] Metrics configured with OTLP exporter:', config.otlpEndpoint)
  } catch (error) {
    console.error('[Observability] Failed to configure metrics:', error)
  }
}

/**
 * Create all UI-specific metrics
 */
function createUIMetrics(): UIMetrics {
  if (!meter) {
    throw new Error('Meter not initialized')
  }

  return {
    pageViews: meter.createCounter(`${GF_METRIC_PREFIX}_page_views_total`, {
      description: 'Total number of page views',
      valueType: ValueType.INT,
    }),

    pageLoadDuration: meter.createHistogram(`${GF_METRIC_PREFIX}_page_load_duration_seconds`, {
      description: 'Page load duration in seconds',
      unit: 's',
      valueType: ValueType.DOUBLE,
    }),

    buttonClicks: meter.createCounter(`${GF_METRIC_PREFIX}_button_clicks_total`, {
      description: 'Total number of button clicks',
      valueType: ValueType.INT,
    }),

    formSubmissions: meter.createCounter(`${GF_METRIC_PREFIX}_form_submissions_total`, {
      description: 'Total number of form submissions',
      valueType: ValueType.INT,
    }),

    apiRequestCount: meter.createCounter(`${GF_METRIC_PREFIX}_api_request_count`, {
      description: 'Total number of API requests',
      valueType: ValueType.INT,
    }),

    apiRequestDuration: meter.createHistogram(`${GF_METRIC_PREFIX}_api_request_duration_seconds`, {
      description: 'Duration of API requests in seconds',
      unit: 's',
      valueType: ValueType.DOUBLE,
    }),

    apiRequestErrors: meter.createCounter(`${GF_METRIC_PREFIX}_api_request_errors_total`, {
      description: 'Total number of API request errors',
      valueType: ValueType.INT,
    }),

    pipelineCreated: meter.createCounter(`${GF_METRIC_PREFIX}_pipeline_created_total`, {
      description: 'Total number of pipelines created',
      valueType: ValueType.INT,
    }),

    pipelineDeleted: meter.createCounter(`${GF_METRIC_PREFIX}_pipeline_deleted_total`, {
      description: 'Total number of pipelines deleted',
      valueType: ValueType.INT,
    }),

    pipelineStatusChanged: meter.createCounter(`${GF_METRIC_PREFIX}_pipeline_status_changed_total`, {
      description: 'Total number of pipeline status changes',
      valueType: ValueType.INT,
    }),
  }
}

/**
 * Get UI metrics instance
 */
export function getUIMetrics(): UIMetrics {
  if (!uiMetrics) {
    throw new Error('Metrics not initialized. Call configureMetrics() first.')
  }
  return uiMetrics
}

/**
 * Helper functions to record common metrics
 */
export const metricsRecorder = {
  recordPageView: (path: string) => {
    if (!uiMetrics) return
    uiMetrics.pageViews.add(1, {
      path,
      component: 'glassflow_ui',
    })
  },

  recordPageLoad: (path: string, durationSeconds: number) => {
    if (!uiMetrics) return
    uiMetrics.pageLoadDuration.record(durationSeconds, {
      path,
      component: 'glassflow_ui',
    })
  },

  recordButtonClick: (buttonName: string) => {
    if (!uiMetrics) return
    uiMetrics.buttonClicks.add(1, {
      button_name: buttonName,
      component: 'glassflow_ui',
    })
  },

  recordFormSubmission: (formName: string, success: boolean) => {
    if (!uiMetrics) return
    uiMetrics.formSubmissions.add(1, {
      form_name: formName,
      success: success.toString(),
      component: 'glassflow_ui',
    })
  },

  recordApiRequest: (method: string, path: string, status: number, durationSeconds: number) => {
    if (!uiMetrics) return

    const attributes = {
      method,
      path,
      status: status.toString(),
      component: 'glassflow_ui',
    }

    uiMetrics.apiRequestCount.add(1, attributes)
    uiMetrics.apiRequestDuration.record(durationSeconds, attributes)

    if (status >= 400) {
      uiMetrics.apiRequestErrors.add(1, attributes)
    }
  },

  recordPipelineCreated: (pipelineType: string) => {
    if (!uiMetrics) return
    uiMetrics.pipelineCreated.add(1, {
      pipeline_type: pipelineType,
      component: 'glassflow_ui',
    })
  },

  recordPipelineDeleted: (pipelineId: string) => {
    if (!uiMetrics) return
    uiMetrics.pipelineDeleted.add(1, {
      pipeline_id: pipelineId,
      component: 'glassflow_ui',
    })
  },

  recordPipelineStatusChange: (pipelineId: string, fromStatus: string, toStatus: string) => {
    if (!uiMetrics) return
    uiMetrics.pipelineStatusChanged.add(1, {
      pipeline_id: pipelineId,
      from_status: fromStatus,
      to_status: toStatus,
      component: 'glassflow_ui',
    })
  },
}

/**
 * Shutdown metrics and flush pending metrics
 */
export async function shutdownMetrics(): Promise<void> {
  if (meterProvider) {
    await meterProvider.shutdown()
    meterProvider = null
    meter = null
    uiMetrics = null
  }
}
