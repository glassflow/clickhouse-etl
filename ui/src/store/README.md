# Store Structure

This directory contains the Zustand store slices for the ClickHouse ETL application.

## Store Architecture

The main store is composed of multiple slices:

- `kafka.store` - Kafka connection and configuration
- `clickhouse-connection.store` - ClickHouse connection settings
- `clickhouse-destination.store` - ClickHouse destination configuration
- `steps.store` - Pipeline step management
- `topics.store` - Kafka topics management
- `join.store` - Join operation configuration
- `pipeline-config.ts` - General pipeline configuration (NEW)

## Pipeline Config Slice

The `pipeline-config.ts` slice contains general pipeline information that was previously scattered throughout the main store:

### Properties

- `pipelineId` - Current pipeline ID
- `pipelineName` - Pipeline name
- `operationsSelected` - Selected operations (deduplication, joining, etc.)
- `outboundEventPreview` - Preview of outbound events
- `analyticsConsent` - User analytics consent
- `consentAnswered` - Whether consent has been answered
- `isDirty` - Whether the pipeline has unsaved changes
- `apiConfig` - API configuration

### Actions

- `setPipelineId(id: string)` - Set pipeline ID
- `setPipelineName(name: string)` - Set pipeline name
- `setOperationsSelected(operations: OperationsSelectedType)` - Set selected operations
- `setOutboundEventPreview(preview: OutboundEventPreviewType)` - Set event preview
- `setAnalyticsConsent(consent: boolean)` - Set analytics consent
- `setConsentAnswered(consent: boolean)` - Set consent answered status
- `markAsDirty()` - Mark pipeline as dirty
- `markAsClean()` - Mark pipeline as clean
- `setApiConfig(config: any)` - Set API configuration
- `resetPipelineState(operation: string, force?: boolean)` - Reset pipeline config state

## Usage

### Accessing Pipeline Config Properties

```typescript
const { configStore } = useStore()
const { pipelineId, pipelineName, operationsSelected } = configStore
```

### Updating Pipeline Config Properties

```typescript
const { configStore } = useStore()
const { setPipelineId, setPipelineName, setOperationsSelected } = configStore

// Update properties
setPipelineId('new-pipeline-id')
setPipelineName('My Pipeline')
setOperationsSelected({ operation: 'deduplication' })
```

### Resetting Pipeline State

For resetting only pipeline config:

```typescript
const { configStore } = useStore()
const { resetPipelineState } = configStore

resetPipelineState('deduplication', true)
```

For resetting all slices (including topics, join, clickhouse destination, etc.):

```typescript
const { resetAllPipelineState } = useStore()

resetAllPipelineState('deduplication', true)
```

## Migration from Old Structure

If you were previously accessing these properties directly from the store:

**Before:**

```typescript
const { pipelineId, setPipelineId, operationsSelected } = useStore()
```

**After:**

```typescript
const { configStore } = useStore()
const { pipelineId, setPipelineId, operationsSelected } = configStore
```

## Benefits

1. **Better Organization**: Pipeline configuration is now grouped together
2. **Separation of Concerns**: Each slice handles its own domain
3. **Easier Testing**: Can test pipeline config logic independently
4. **Type Safety**: Better TypeScript support with proper interfaces
5. **Maintainability**: Easier to modify pipeline config without affecting other slices
