// Core analytics functionality
export { initAnalytics, track, setUserIdentity, setAnalyticsEnabled, loadAnalyticsPreference } from './eventManager'

export { dictionary } from './eventDictionary'

// Journey tracking helpers
export {
  trackGeneral,
  trackJourney,
  trackPage,
  trackOperation,
  trackKafka,
  trackTopic,
  trackKey,
  trackJoin,
  trackClickhouse,
  trackDestination,
  trackDeploy,
  trackPipeline,
} from './journeyTracker'

// Export type definitions
export type { EventGroup, Contexts } from './eventManager'
export type { Event } from './eventDictionary'
