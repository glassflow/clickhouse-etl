# Analytics Migration Guide

This guide will help you migrate from the old analytics system to the new journey-based analytics system.

## Why Migrate?

The new analytics system offers several benefits:

1. **Better Funnel Tracking**: Each event is now a top-level event in Mixpanel, making it easier to create funnel reports
2. **Type Safety**: The new API provides better type safety and autocompletion
3. **Clear Event Names**: Descriptive event names make analysis more intuitive
4. **Improved Organization**: Events are organized by journey step for better clarity

## Migration Steps

### Step 1: Change Hook Import

Instead of:

```typescript
import { useAnalytics } from '@/src/hooks/useAnalytics'
```

Use:

```typescript
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
```

### Step 2: Update Hook Usage

#### Old way:

```typescript
const { trackPageView, trackFunnelStep } = useAnalytics()

// Track page view
useEffect(() => {
  trackPageView('pipelines')
}, [trackPageView])

// Track funnel step
const handleKafkaConnect = () => {
  trackFunnelStep('kafkaConnectionStarted')
  // ...
}
```

#### New way:

```typescript
const analytics = useJourneyAnalytics()

// Track page navigation
useEffect(() => {
  analytics.page.homepage()
}, [analytics])

// Track operations
const handleDeduplicationClick = () => {
  analytics.operation.deduplication()
  // ...
}

// Track Kafka connection
const handleKafkaConnect = () => {
  analytics.kafka.started()
  // ...
}
```

### Step 3: Use Type-Safe Event Properties

The new system provides better property typing:

```typescript
// Add detailed properties to events
analytics.topic.selected({
  topicName: 'user-events',
  partitionCount: 3,
  messageRate: 1200,
})

analytics.deploy.clicked({
  pipelineType: 'deduplication',
  sourceCount: 2,
  destinationTable: 'user_events_deduped',
})
```

## Transitional Period

During the transition period, the old `useAnalytics` hook has been updated to:

1. Show a deprecation warning in development
2. Map old events to new ones where possible
3. Provide access to the new API via `analytics.journey`

You can use this for gradual migration:

```typescript
const analytics = useAnalytics()

// Old way (deprecated)
analytics.trackFunnelStep('kafkaConnectionStarted')

// New way (preferred)
analytics.journey.kafka.started()
```

## Event Mapping Reference

### Page Events

| Legacy                            | New                            |
| --------------------------------- | ------------------------------ |
| `trackPageView('home')`           | `analytics.page.homepage()`    |
| `trackPageView('pipelineCreate')` | _Map to specific journey page_ |

### Funnel Steps

| Legacy                                      | New                               |
| ------------------------------------------- | --------------------------------- |
| `trackFunnelStep('kafkaConnectionStarted')` | `analytics.kafka.started()`       |
| `trackFunnelStep('kafkaConnectionSuccess')` | `analytics.kafka.success()`       |
| `trackFunnelStep('kafkaConnectionFailed')`  | `analytics.kafka.failed()`        |
| `trackFunnelStep('topicSelected')`          | `analytics.topic.selected()`      |
| `trackFunnelStep('eventReceived')`          | `analytics.topic.eventReceived()` |
| `trackFunnelStep('deployClicked')`          | `analytics.deploy.clicked()`      |
| `trackFunnelStep('deploySuccess')`          | `analytics.deploy.success()`      |
| `trackFunnelStep('deployFailed')`           | `analytics.deploy.failed()`       |

### Feature Usage

| Legacy                               | New                                   |
| ------------------------------------ | ------------------------------------- |
| `trackFeatureUsage('deduplication')` | `analytics.operation.deduplication()` |
| `trackFeatureUsage('joining')`       | `analytics.operation.join()`          |
| `trackFeatureUsage('ingestOnly')`    | `analytics.operation.ingestOnly()`    |

### Pipeline Actions

| Legacy                          | New                                  |
| ------------------------------- | ------------------------------------ |
| `trackPipelineAction('delete')` | `analytics.pipeline.deleteClicked()` |
| `trackPipelineAction('modify')` | `analytics.pipeline.modifyClicked()` |
| `trackPipelineAction('deploy')` | `analytics.deploy.clicked()`         |

## Creating Funnels in Mixpanel

With the new events, creating a funnel in Mixpanel is straightforward:

1. Go to the Funnels section in Mixpanel
2. Create a new funnel with these events in sequence:
   - P0_Homepage
   - P1_SetupKafkaConnection
   - P2_SelectTopic
   - P3_DeduplicationKey (or P3_JoinKey for join paths)
   - P4_SetupClickhouseConnection
   - P5_SelectDestination
   - Deploy_Success
   - P6_PipelineActive

This will show you the conversion rate at each step of your user journey.
