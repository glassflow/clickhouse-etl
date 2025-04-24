/**
 * Simplified analytics implementation that only logs events to console
 * This can be used as a quick replacement if the Mixpanel integration is causing issues
 */

import { Event } from './eventDictionary'

// Flag to indicate whether debug logging is enabled
const isDev = process.env.NODE_ENV !== 'production'

// Tracking event cache to prevent duplicate events
const eventCache = new Map<string, number>()
const CACHE_TTL = 2000

/**
 * Track an event - this simplified version just logs to console
 */
export const track = ({
  event,
  context,
  properties,
}: {
  event: Event
  context: unknown
  properties?: Record<string, unknown>
}) => {
  try {
    // Create a cache key for deduplication
    const cacheKey = `${event.name}:${String(context)}:${JSON.stringify(properties || {})}`
    const now = Date.now()
    const lastTracked = eventCache.get(cacheKey) || 0

    // Skip if tracked too recently
    if (now - lastTracked < CACHE_TTL) {
      return
    }

    // Update cache
    eventCache.set(cacheKey, now)

    // Clean cache if too large
    if (eventCache.size > 50) {
      const keysToDelete: string[] = []
      eventCache.forEach((timestamp, key) => {
        if (now - timestamp > CACHE_TTL * 5) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach((key) => eventCache.delete(key))
    }

    // In development mode, log the event
    if (isDev) {
      console.log('Analytics event:', {
        event: event.name,
        context,
        properties,
      })
    }
  } catch (error) {
    console.error('Error tracking simplified event:', error)
  }
}

/**
 * Hook-like function to use simplified analytics
 * This mimics the interface of useAnalytics but doesn't use any actual tracking
 */
export const useSimplifiedAnalytics = () => {
  // Simplified implementation that does nothing but log
  const trackEvent = (event: Event, context: string, properties?: Record<string, unknown>) => {
    track({ event, context, properties })
  }

  const noop = (arg1: any, properties?: Record<string, unknown>) => {
    if (isDev) {
      console.log('Simplified analytics call:', { arg1, properties })
    }
  }

  // Return the same interface as useAnalytics
  return {
    trackEvent,
    trackPageView: noop,
    trackFunnelStep: noop,
    trackPipelineAction: noop,
    trackConfigAction: noop,
    trackFeatureUsage: noop,
    trackEngagement: noop,
    trackError: noop,
    trackPerformance: noop,
    trackSatisfactionScore: noop,
    isEnabled: true,
  }
}

// Re-export the dictionary for compatibility
export { dictionary } from './eventDictionary'
