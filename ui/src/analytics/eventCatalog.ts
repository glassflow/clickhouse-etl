import { dictionary } from './eventDictionary'

const eventCatalog: Record<string, boolean> = {
  // View events
  [dictionary.pageView.name]: true,

  // User preference events
  [dictionary.userPreference.name]: true,

  // Funnel events
  [dictionary.funnel.name]: true,

  // Pipeline events
  [dictionary.pipelineAction.name]: true,

  // Configuration events
  [dictionary.configurationAction.name]: true,

  // Feature usage events
  [dictionary.featureUsage.name]: true,

  // User engagement events
  [dictionary.engagement.name]: true,

  // Error events
  [dictionary.errorOccurred.name]: true,

  // Performance metrics
  [dictionary.performance.name]: true,
}

export default eventCatalog
