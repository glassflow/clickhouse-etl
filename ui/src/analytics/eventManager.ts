import { useStore } from '@/src/store'
import eventCatalog from './eventCatalog'
import { type Contexts, type EventGroup, dictionary } from './eventDictionary'
import type { Event } from './eventDictionary'
import mixpanel from 'mixpanel-browser'

export type { EventGroup, Contexts }

// Flag to indicate whether analytics should be enabled
let analyticsEnabled = false

// Try to use the environment variable, but fall back to hardcoded token if needed
// This ensures tracking works in all environments including Docker production deployments
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '209670ec9b352915013a5dfdb169dd25'

// Determine if we're in development mode
// In Docker, process.env.NODE_ENV will typically be 'production'
const isDev = process.env.NODE_ENV !== 'production'

// Initialize mixpanel - this should be called when your app starts
export const initAnalytics = () => {
  try {
    // Log initialization info in both dev and production for troubleshooting
    const tokenPreview = MIXPANEL_TOKEN.substring(0, 4) + '...' + MIXPANEL_TOKEN.substring(MIXPANEL_TOKEN.length - 4)
    console.log(`Initializing Mixpanel with token: ${tokenPreview} (${isDev ? 'Development' : 'Production'} mode)`)
    console.log('Environment:', process.env.NODE_ENV || 'not set')

    // Initialize mixpanel with the token
    mixpanel.init(MIXPANEL_TOKEN, {
      persistence: 'localStorage',
      debug: isDev,
      // @ts-expect-error FIXME: explore why autocapture is not typed on Mixpanel
      autocapture: false,
      track_pageview: 'url-with-path',
    })

    // In production, disable debug logs after initialization
    if (!isDev) {
      mixpanel.set_config({
        debug: false,
      })
    }

    console.log('Analytics initialized successfully')
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
    })

    if (isDev) {
      console.log('User identified for analytics:', userId)
    }
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

  console.log(`Analytics ${enabled ? 'enabled' : 'disabled'}`)
}

// Load analytics preference from localStorage
export const loadAnalyticsPreference = (): boolean => {
  if (typeof window !== 'undefined') {
    const storedValue = localStorage.getItem('analytics-enabled')
    return storedValue === 'true'
  }
  return false
}

// Track an event
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
    // Only track if analytics is enabled and the event is in the catalog
    if (analyticsEnabled && event.name in eventCatalog) {
      const eventProps = {
        event: event.name,
        context: context,
        ...properties,
      }

      mixpanel.track(event.name, eventProps)

      if (isDev) {
        console.log('Analytics event tracked:', eventProps)
      }
    } else if (isDev) {
      console.log('Analytics event not tracked:', {
        event: event.name,
        context: context,
        ...properties,
      })
    }
  } catch (error) {
    console.error('Error tracking event:', error)
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
