import { useStore } from '@/src/store'
import eventCatalog from './eventCatalog'
import { type Contexts, type EventGroup, dictionary } from './eventDictionary'
import type { Event } from './eventDictionary'
import { isAnalyticsEnabled } from '@/src/utils/common.client'
import mixpanel from 'mixpanel-browser'

export type { EventGroup, Contexts }

// Flag to indicate whether analytics should be enabled
let analyticsEnabled = false

// Add a timestamp tracker to prevent excessive event tracking
const eventCache = new Map<string, number>()
const EVENT_THROTTLE_MS = 1000 // Minimum time between identical events

// Try to use the environment variable, but fall back to hardcoded token if needed
// This ensures tracking works in all environments including Docker production deployments
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '209670ec9b352915013a5dfdb169dd25'

// Determine if we're in development mode
// In Docker, process.env.NODE_ENV will typically be 'production'
const isDev = process.env.NODE_ENV !== 'production'

// Check if the current user is internal
const isInternalUser = (): boolean => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('glassflow-is-internal') === 'true'
}

// Initialize mixpanel - this should be called when your app starts
export const initAnalytics = () => {
  try {
    // Log initialization info in both dev and production for troubleshooting
    const tokenPreview = MIXPANEL_TOKEN.substring(0, 4) + '...' + MIXPANEL_TOKEN.substring(MIXPANEL_TOKEN.length - 4)

    // Initialize mixpanel with the token
    mixpanel.init(MIXPANEL_TOKEN, {
      persistence: 'localStorage',
      debug: isDev,
      autocapture: false as const,
      track_pageview: 'url-with-path',
    })

    // In production, disable debug logs after initialization
    if (!isDev) {
      mixpanel.set_config({
        debug: false,
      })
    }
  } catch (error) {
    console.error('Failed to initialize analytics:', error)
  }
}

// Identify a user with a unique ID for tracking
export const setUserIdentity = (userId: string) => {
  try {
    if (typeof window === 'undefined') return // Skip on server-side rendering

    mixpanel.identify(userId)

    // Register some additional user properties
    mixpanel.people.set({
      $distinct_id: userId,
      'First Seen': new Date().toISOString(),
      'User Type': 'Anonymous',
      'App Version': process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
      Platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      'User Agent': typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      'Internal User': isInternalUser(),
    })

    // if (isDev) {
    // console.log('User identified for analytics:', userId)
    // }
  } catch (error) {
    console.error('Failed to set user identity:', error)
  }
}

// Function to enable or disable analytics based on user consent
export const setAnalyticsEnabled = (enabled: boolean) => {
  analyticsEnabled = enabled

  // Store the preference in localStorage as well
  if (typeof window !== 'undefined') {
    localStorage.setItem('analytics-enabled', enabled.toString())
  }
}

// Load analytics preference from localStorage
export const loadAnalyticsPreference = (): boolean => {
  if (typeof window !== 'undefined') {
    const storedValue = localStorage.getItem('analytics-enabled')
    return storedValue === 'true'
  }
  return false
}

// Generate a cache key for event throttling
const getEventCacheKey = (eventName: string, context: unknown, properties?: Record<string, unknown>) => {
  try {
    return `${eventName}:${String(context)}:${JSON.stringify(properties || {})}`
  } catch (e) {
    return `${eventName}:${String(context)}`
  }
}

// Track an event
export const track = ({
  event,
  context,
  properties,
}: {
  event: Event
  context: unknown
  properties?: Record<string, unknown> & {
    overrideTrackingConsent?: boolean
  }
}) => {
  const { overrideTrackingConsent } = properties || {}
  try {
    // Guard: exit early if window is not defined (SSR)
    if (typeof window === 'undefined') return

    // Only track if analytics is enabled via environment variable and the event is in the catalog
    if (!isAnalyticsEnabled() && !overrideTrackingConsent) {
      // NOTE: uncomment this if you want to see the analytics disabled logs
      // if (isDev) {
      //   console.log('Analytics disabled via environment variable, not tracking:', {
      //     event: event.name,
      //     context,
      //     ...properties,
      //   })
      // }
      return
    }

    if (!(event.name in eventCatalog)) {
      // if (isDev) {
      // console.log('Event not in catalog, not tracking:', event.name)
      // }
      return
    }

    // Generate a cache key to prevent duplicate events
    const cacheKey = getEventCacheKey(event.name, context, properties)
    const now = Date.now()

    // Check if we've recently tracked this exact event
    if (eventCache.has(cacheKey)) {
      const lastTracked = eventCache.get(cacheKey) || 0
      if (now - lastTracked < EVENT_THROTTLE_MS) {
        if (isDev) {
          // console.log('Event throttled (too frequent):', {
          //   event: event.name,
          //   context,
          //   timeSinceLast: now - lastTracked,
          // })
        }
        return
      }
    }

    // Update the cache with current timestamp
    eventCache.set(cacheKey, now)

    // Clean up old cache entries periodically (every 50 events)
    if (eventCache.size > 50) {
      const keysToDelete: string[] = []
      eventCache.forEach((timestamp, key) => {
        if (now - timestamp > EVENT_THROTTLE_MS * 10) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach((key) => eventCache.delete(key))
    }

    // Create event properties and track
    const eventProps = {
      event: event.name,
      context: context,
      isInternalUser: isInternalUser(),
      ...properties,
    }

    try {
      mixpanel.track(event.name, eventProps)

      // if (isDev) {
      // console.log('Analytics event tracked:', eventProps)
      // }
    } catch (trackError) {
      console.error('Error during mixpanel.track():', trackError)
    }
  } catch (error) {
    console.error('Error in track function:', error)
  }
}

// Helper function to get context from event dictionary
export const getContext = (eventKey: string, contextStr: string) => {
  try {
    // Iterate through all events in dictionary
    for (const [_, event] of Object.entries(dictionary)) {
      // Check if this is the event we're looking for and it has contexts
      if (event.key === eventKey && event.contexts) {
        // Look through contexts for exact or partial match
        for (const [contextKey, contextValue] of Object.entries(event.contexts)) {
          if (
            contextValue === contextStr ||
            contextValue.toLowerCase().includes(contextStr.toLowerCase()) ||
            contextStr.toLowerCase().includes(contextValue.toLowerCase())
          ) {
            return contextValue
          }
        }
      }
    }

    return contextStr // Return original if no match found
  } catch (error) {
    console.error('Error getting context:', error)
    return contextStr
  }
}

export { dictionary } from './eventDictionary'
