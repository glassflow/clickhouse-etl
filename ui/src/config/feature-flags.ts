/**
 * Feature Flags Module
 *
 * Centralized module for managing feature flags via environment variables.
 * Handles both server-side (process.env) and client-side (window.__ENV__) access.
 *
 * Environment variables must be prefixed with NEXT_PUBLIC_ to be accessible on the client.
 */

import { getRuntimeEnv } from '@/src/utils/common.client'

/**
 * Helper to get a feature flag value from environment.
 * Checks runtime env first (for Docker builds), then falls back to process.env.
 */
const getFeatureFlag = (envKey: string): boolean => {
  const isServer = typeof window === 'undefined'

  if (isServer) {
    // For server-side, use process.env directly
    return process.env[envKey] === 'true'
  } else {
    // For client-side, check runtime environment first (for Docker builds)
    const runtimeEnv = getRuntimeEnv() as Record<string, string | undefined>

    if (runtimeEnv[envKey] !== undefined) {
      return runtimeEnv[envKey] === 'true'
    }

    // Fallback to process.env (for build-time env vars)
    return process.env[envKey] === 'true'
  }
}

/**
 * Check if filters feature is enabled.
 * Controls visibility of the filter configurator in pipeline creation and editing.
 *
 * @env NEXT_PUBLIC_FILTERS_ENABLED - Set to 'true' to enable filters
 */
export const isFiltersEnabled = (): boolean => {
  return getFeatureFlag('NEXT_PUBLIC_FILTERS_ENABLED')
}

/**
 * Check if analytics is enabled.
 * Controls whether analytics events are tracked.
 *
 * @env NEXT_PUBLIC_ANALYTICS_ENABLED - Set to 'true' to enable analytics
 */
export const isAnalyticsEnabled = (): boolean => {
  return getFeatureFlag('NEXT_PUBLIC_ANALYTICS_ENABLED')
}

/**
 * Check if demo mode is enabled.
 * In demo mode, certain editing/destructive actions are disabled.
 *
 * @env NEXT_PUBLIC_DEMO_MODE - Set to 'true' to enable demo mode
 */
export const isDemoMode = (): boolean => {
  return getFeatureFlag('NEXT_PUBLIC_DEMO_MODE')
}

/**
 * Check if preview mode is enabled.
 * Shows the Review & Deploy step in the wizard.
 *
 * @env NEXT_PUBLIC_PREVIEW_MODE - Set to 'true' to enable preview mode
 */
export const isPreviewModeEnabled = (): boolean => {
  return getFeatureFlag('NEXT_PUBLIC_PREVIEW_MODE')
}

/**
 * Check if transformations feature is enabled.
 * Controls visibility of the transformation configurator in pipeline creation and editing.
 *
 * @env NEXT_PUBLIC_TRANSFORMATIONS_ENABLED - Set to 'true' to enable transformations
 */
export const isTransformationsEnabled = (): boolean => {
  return getFeatureFlag('NEXT_PUBLIC_TRANSFORMATIONS_ENABLED')
}

/**
 * Check if shared notifications feature is enabled.
 * Controls visibility of the notification system UI components including
 * the notification badge, panel, and settings.
 * When disabled, no traces of the notification system are visible in the UI.
 *
 * @env NEXT_PUBLIC_NOTIFICATIONS_ENABLED - Set to 'true' to enable notifications
 */
export const isNotificationsEnabled = (): boolean => {
  return getFeatureFlag('NEXT_PUBLIC_NOTIFICATIONS_ENABLED')
}
