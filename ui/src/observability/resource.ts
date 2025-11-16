/**
 * Resource attributes builder for OpenTelemetry
 * Matches glassflow-api/pkg/observability/resource.go
 */

import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import type { ObservabilityConfig } from './config'
import { ATTR_SERVICE_NAMESPACE, ATTR_SERVICE_INSTANCE_ID } from './semconv'

/**
 * Build resource attributes from configuration
 * Creates a consistent set of resource attributes for both logging and metrics
 */
export function buildResourceAttributes(config: ObservabilityConfig): Resource {
  const attributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
  }

  // Add service namespace if provided
  if (config.serviceNamespace) {
    attributes[ATTR_SERVICE_NAMESPACE] = config.serviceNamespace
  }

  // Add service instance ID if provided
  if (config.serviceInstanceId) {
    attributes[ATTR_SERVICE_INSTANCE_ID] = config.serviceInstanceId
  }

  return new Resource(attributes)
}
