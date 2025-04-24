import { useStore } from '@/src/store'
import eventCatalog from './eventCatalog'
import { type Contexts, type EventGroup, dictionary } from './eventDictionary'
import type { Event } from './eventDictionary'
import mixpanel from 'mixpanel-browser'

export type { EventGroup, Contexts }

// Flag to indicate whether analytics should be enabled
let analyticsEnabled = false

// Using environment variables for token, or a placeholder if not available
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || 'your-mixpanel-token'
const isDev = process.env.NODE_ENV === 'development'

// Initialize mixpanel - this should be called when your app starts
export const initAnalytics = () => {
  try {
    // Initialize mixpanel with token from environment variables
    mixpanel.init(MIXPANEL_TOKEN, {
      persistence: 'localStorage',
      debug: isDev,
      // @ts-expect-error FIXME: explore why autocapture is not typed on Mixpanel
      autocapture: false,
      track_pageview: 'url-with-path',
    })

    // Disable debug log after initialization in production
    if (!isDev) {
      mixpanel.set_config({
        debug: false,
      })
    }

    console.log('Analytics initialized')
  } catch (error) {
    console.error('Failed to initialize analytics:', error)
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
