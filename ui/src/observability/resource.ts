/**
 * Resource attributes builder for OpenTelemetry
 * Matches glassflow-api/pkg/observability/resource.go
 */

import { Resource } from '@opentelemetry/resources'
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_SERVICE_NAMESPACE,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
} from '@opentelemetry/semantic-conventions'
import type { ObservabilityConfig } from './config'

/**
 * Build resource attributes from configuration
 * Creates a consistent set of resource attributes for both logging and metrics
 */
export function buildResourceAttributes(config: ObservabilityConfig): Resource {
  const attributes: Record<string, string> = {
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
  }

  // Add service namespace if provided
  if (config.serviceNamespace) {
    attributes[SEMRESATTRS_SERVICE_NAMESPACE] = config.serviceNamespace
  }

  // Add service instance ID if provided
  if (config.serviceInstanceId) {
    attributes[SEMRESATTRS_SERVICE_INSTANCE_ID] = config.serviceInstanceId
  }

  return new Resource(attributes)
}
