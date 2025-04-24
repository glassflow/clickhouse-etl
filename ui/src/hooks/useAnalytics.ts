import { useStore } from '@/src/store'
import { track, dictionary } from '@/src/analytics/eventManager'
import type { Event } from '@/src/analytics/eventDictionary'

/**
 * Hook to easily track analytics events throughout the application
 */
export function useAnalytics() {
  const { analyticsConsent } = useStore()

  /**
   * Track an analytics event if the user has consented
   */
  const trackEvent = (event: Event, context: string, properties?: Record<string, unknown>) => {
    // Only track if user has consented
    if (analyticsConsent) {
      track({
        event,
        context,
        properties,
      })
    }
  }

  /**
   * Track a page view
   */
  const trackPageView = (page: string, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.pageView, page, properties)
  }

  /**
   * Track a funnel step
   */
  const trackFunnelStep = (step: string, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.funnel, step, properties)
  }

  /**
   * Track a pipeline action
   */
  const trackPipelineAction = (action: string, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.pipelineAction, action, properties)
  }

  /**
   * Track a configuration action
   */
  const trackConfigAction = (action: string, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.configurationAction, action, properties)
  }

  /**
   * Track feature usage
   */
  const trackFeatureUsage = (feature: string, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.featureUsage, feature, properties)
  }

  /**
   * Track user engagement
   */
  const trackEngagement = (type: string, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.engagement, type, properties)
  }

  /**
   * Track an error
   */
  const trackError = (errorType: string, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.errorOccurred, errorType, properties)
  }

  /**
   * Track performance metrics
   */
  const trackPerformance = (metric: string, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.performance, metric, properties)
  }

  /**
   * Track satisfaction score
   */
  const trackSatisfactionScore = (score: number, properties?: Record<string, unknown>) => {
    trackEvent(dictionary.userPreference, 'satisfactionScore', {
      score,
      ...properties,
    })
  }

  return {
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
  }
}
