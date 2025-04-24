import { useStore } from '@/src/store'
import { track, dictionary } from '@/src/analytics/eventManager'
import type { Event } from '@/src/analytics/eventDictionary'
import { useCallback, useMemo } from 'react'

// Add a simple memoization cache to prevent duplicate calls
const trackingCache = new Map<string, number>()
const TRACKING_CACHE_TTL = 2000 // 2 seconds

/**
 * Hook to easily track analytics events throughout the application
 */
export function useAnalytics() {
  const { analyticsConsent } = useStore()

  /**
   * Track an analytics event if the user has consented
   */
  const trackEvent = useCallback(
    (event: Event, context: string, properties?: Record<string, unknown>) => {
      // Only track if user has consented
      if (analyticsConsent) {
        // Create a cache key based on event and context
        const cacheKey = `${event.name}:${context}:${JSON.stringify(properties || {})}`
        const now = Date.now()
        const lastTracked = trackingCache.get(cacheKey) || 0

        // Only track if this event hasn't been tracked recently
        if (now - lastTracked > TRACKING_CACHE_TTL) {
          trackingCache.set(cacheKey, now)

          // Clean up old entries
          if (trackingCache.size > 100) {
            const keysToDelete: string[] = []
            trackingCache.forEach((time, key) => {
              if (now - time > TRACKING_CACHE_TTL * 5) {
                keysToDelete.push(key)
              }
            })
            keysToDelete.forEach((key) => trackingCache.delete(key))
          }

          track({
            event,
            context,
            properties,
          })
        }
      }
    },
    [analyticsConsent],
  )

  /**
   * Track a page view
   */
  const trackPageView = useCallback(
    (page: string, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.pageView, page, properties)
    },
    [trackEvent],
  )

  /**
   * Track a funnel step
   */
  const trackFunnelStep = useCallback(
    (step: string, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.funnel, step, properties)
    },
    [trackEvent],
  )

  /**
   * Track a pipeline action
   */
  const trackPipelineAction = useCallback(
    (action: string, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.pipelineAction, action, properties)
    },
    [trackEvent],
  )

  /**
   * Track a configuration action
   */
  const trackConfigAction = useCallback(
    (action: string, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.configurationAction, action, properties)
    },
    [trackEvent],
  )

  /**
   * Track feature usage
   */
  const trackFeatureUsage = useCallback(
    (feature: string, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.featureUsage, feature, properties)
    },
    [trackEvent],
  )

  /**
   * Track user engagement
   */
  const trackEngagement = useCallback(
    (type: string, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.engagement, type, properties)
    },
    [trackEvent],
  )

  /**
   * Track an error
   */
  const trackError = useCallback(
    (errorType: string, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.errorOccurred, errorType, properties)
    },
    [trackEvent],
  )

  /**
   * Track performance metrics
   */
  const trackPerformance = useCallback(
    (metric: string, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.performance, metric, properties)
    },
    [trackEvent],
  )

  /**
   * Track satisfaction score
   */
  const trackSatisfactionScore = useCallback(
    (score: number, properties?: Record<string, unknown>) => {
      trackEvent(dictionary.userPreference, 'satisfactionScore', {
        score,
        ...properties,
      })
    },
    [trackEvent],
  )

  // Return memoized object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      trackEvent,
      trackPageView,
      trackFunnelStep,
      trackPipelineAction,
      trackConfigAction,
      trackFeatureUsage,
      trackEngagement,
      trackError,
      trackPerformance,
      trackSatisfactionScore,
      isEnabled: analyticsConsent,
    }),
    [
      trackEvent,
      trackPageView,
      trackFunnelStep,
      trackPipelineAction,
      trackConfigAction,
      trackFeatureUsage,
      trackEngagement,
      trackError,
      trackPerformance,
      trackSatisfactionScore,
      analyticsConsent,
    ],
  )
}
