# Pipeline State Manager Refactor - Product Requirements Document

## 📋 Overview

This document outlines the refactoring of the GlassFlow UI pipeline state management to address complexity issues in pipeline editing, particularly around state recreation, dependency management, and change tracking.

## 🎯 Problem Statement

### Current Issues

1. **Complex State Recreation**: When editing a deployed pipeline, the UI must recreate its state by hydrating multiple Zustand stores with pipeline configuration data. This requires manual coordination of multiple hydration functions.

2. **No Change Tracking**: Users can make changes to pipeline configuration but have no easy way to discard changes or see what has been modified.

3. **Dependency Management**: Pipeline steps have interdependent validation logic (e.g., changing a topic invalidates deduplication, join, and mapper steps), but this is not clearly communicated to users.

4. **Component Reuse Complexity**: The same components are used for both pipeline creation and editing, leading to complex conditional logic and mixed responsibilities.

5. **Error Handling**: No centralized error handling for state management operations.

## 🚀 Solution Overview

### PipelineStateManager

A centralized abstraction layer over existing Zustand stores that provides:

- **Unified Interface**: Simple methods for loading, saving, and managing pipeline state
- **Change Tracking**: Automatic detection and management of configuration changes
- **Dependency Management**: Automatic invalidation of dependent steps when upstream changes occur
- **Error Handling**: Centralized error management for all state operations

## 🏗️ Architecture

### Core Components

#### 1. Store Instance Factory Pattern

The architecture uses a **Factory Pattern** to create separate store instances for different pipeline journeys, ensuring true isolation between creation and editing workflows.

```typescript
// src/store/pipeline-store-factory.ts
type PipelineJourney = 'creation' | 'editing'

interface PipelineStoreInstance {
  id: string
  journey: PipelineJourney
  store: Store
  createdAt: Date
  lastAccessed: Date
}

class PipelineStoreFactory {
  private instances: Map<string, PipelineStoreInstance> = new Map()

  createInstance(journey: PipelineJourney, pipelineId?: string): PipelineStoreInstance {
    const instanceId = this.generateInstanceId(journey, pipelineId)

    // Check if instance already exists
    const existingInstance = this.instances.get(instanceId)
    if (existingInstance) {
      existingInstance.lastAccessed = new Date()
      return existingInstance
    }

    // Create new instance
    const newInstance: PipelineStoreInstance = {
      id: instanceId,
      journey,
      store: this.createStoreInstance(journey),
      createdAt: new Date(),
      lastAccessed: new Date(),
    }

    this.instances.set(instanceId, newInstance)
    return newInstance
  }

  getInstance(journey: PipelineJourney, pipelineId?: string): PipelineStoreInstance | null {
    const instanceId = this.generateInstanceId(journey, pipelineId)
    return this.instances.get(instanceId) || null
  }

  cleanupOldInstances(maxAge: number = 30 * 60 * 1000): void {
    // 30 minutes
    const now = new Date()
    for (const [id, instance] of this.instances.entries()) {
      if (now.getTime() - instance.lastAccessed.getTime() > maxAge) {
        this.instances.delete(id)
      }
    }
  }

  private generateInstanceId(journey: PipelineJourney, pipelineId?: string): string {
    if (journey === 'creation') {
      return `creation-${Date.now()}`
    } else {
      return `editing-${pipelineId}`
    }
  }

  private createStoreInstance(journey: PipelineJourney): Store {
    // Create a fresh Zustand store instance
    return create<Store>()(
      devtools(
        (set, get, store) => ({
          ...createKafkaSlice(set, get, store),
          ...createClickhouseConnectionSlice(set, get, store),
          ...createClickhouseDestinationSlice(set, get, store),
          ...createStepsSlice(set, get, store),
          ...createTopicsSlice(set, get, store),
          ...createDeduplicationSlice(set, get, store),
          ...createTopicSelectionDraftSlice(set, get, store),
          ...createJoinSlice(set, get, store),
          ...createPipelineConfigSlice(set, get, store),

          // Journey-specific initialization
          journey,
          initializeForJourney: (journey: PipelineJourney) => {
            if (journey === 'creation') {
              // Reset to clean state for creation
              set((state) => ({
                ...state,
                configStore: {
                  ...state.configStore,
                  isDirty: false,
                },
                topicsStore: {
                  ...state.topicsStore,
                  topics: {},
                  topicCount: 1,
                },
                deduplicationStore: {
                  ...state.deduplicationStore,
                  deduplicationConfigs: {},
                },
                joinStore: {
                  ...state.joinStore,
                  enabled: false,
                  streams: [],
                },
              }))
            }
          },

          // Global reset function
          resetAllPipelineState: (operation: string, force = false) => {
            // ... existing reset logic
          },
        }),
        {
          name: `pipeline-store-${journey}`,
          enabled: process.env.NODE_ENV !== 'production',
        },
      ),
    )
  }
}

// Global factory instance
export const pipelineStoreFactory = new PipelineStoreFactory()
```

#### 2. PipelineStateManager Hook

The PipelineStateManager provides a unified interface for both creation and editing journeys, with journey-specific behavior.

```typescript
interface PipelineStateManager {
  // Core operations
  loadPipeline: (pipeline: Pipeline) => Promise<void>
  savePipeline: () => Promise<Pipeline>
  resetToOriginal: () => void
  hasChanges: () => boolean

  // State queries
  getCurrentState: () => PipelineConfiguration
  getOriginalState: () => PipelineConfiguration
  isLoading: boolean
  error: string | null

  // Instance management
  instanceId: string
  journey: PipelineJourney
  switchToCreation: () => void
  switchToEditing: (pipelineId: string) => Promise<void>
  getInstanceInfo: () => { id: string; journey: PipelineJourney; createdAt: Date }

  // Dependency management (editing only)
  invalidateStep: (stepKey: StepKeys) => void
  getStepValidation: (stepKey: StepKeys) => { isValid: boolean; reason?: string }
  getInvalidatedSteps: () => StepKeys[]
  resetInvalidatedSteps: () => void
}
```

#### 3. Journey-Aware Hook

A higher-level hook that manages journey transitions and provides journey-specific functionality.

```typescript
// src/hooks/usePipelineJourney.ts
export function usePipelineJourney() {
  const [currentJourney, setCurrentJourney] = useState<PipelineJourney>('creation')
  const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(null)
  const pipelineManager = usePipelineStateManager(currentPipelineId || undefined)

  const startCreation = useCallback(() => {
    setCurrentJourney('creation')
    setCurrentPipelineId(null)
    pipelineManager.switchToCreation()
  }, [pipelineManager])

  const startEditing = useCallback(
    async (pipelineId: string) => {
      setCurrentJourney('editing')
      setCurrentPipelineId(pipelineId)
      await pipelineManager.switchToEditing(pipelineId)
    },
    [pipelineManager],
  )

  const getJourneyInfo = useCallback(() => {
    const instanceInfo = pipelineManager.getInstanceInfo()
    return {
      journey: currentJourney,
      pipelineId: currentPipelineId,
      instanceId: instanceInfo.id,
      isCreation: currentJourney === 'creation',
      isEditing: currentJourney === 'editing',
    }
  }, [currentJourney, currentPipelineId, pipelineManager])

  return {
    currentJourney,
    currentPipelineId,
    pipelineManager,
    startCreation,
    startEditing,
    getJourneyInfo,
  }
}
```

#### 4. Step Dependencies Configuration

```typescript
const STEP_DEPENDENCIES: Record<StepKeys, StepDependency> = {
  [StepKeys.KAFKA_CONNECTION]: {
    stepKey: StepKeys.KAFKA_CONNECTION,
    dependsOn: [],
    invalidates: [
      StepKeys.TOPIC_SELECTION_1,
      StepKeys.TOPIC_SELECTION_2,
      StepKeys.DEDUPLICATION_CONFIGURATOR,
      StepKeys.JOIN_CONFIGURATOR,
      StepKeys.CLICKHOUSE_MAPPER,
    ],
  },
  [StepKeys.TOPIC_SELECTION_1]: {
    stepKey: StepKeys.TOPIC_SELECTION_1,
    dependsOn: [StepKeys.KAFKA_CONNECTION],
    invalidates: [StepKeys.DEDUPLICATION_CONFIGURATOR, StepKeys.JOIN_CONFIGURATOR, StepKeys.CLICKHOUSE_MAPPER],
  },
  // ... other step dependencies
}
```

#### 5. Enhanced UI Components

- **PipelineWizard**: Simplified for creation journey
- **PipelineDetailsModule**: Enhanced for editing journey with change tracking
- **StandaloneStepRenderer**: Journey-aware step rendering
- **Step Components**: Modified to notify about changes and show validation status

## 📋 Implementation Plan

### Phase 1: Core PipelineStateManager (1-2 days)

#### 1.1 Create PipelineStateManager Hook

**File**: `src/store/pipeline-state-manager.ts`

**Key Features**:

- Centralized state loading and saving
- Original state preservation for change detection
- Error handling and loading states
- Change tracking with `hasChanges()` method

**Implementation**:

```typescript
export function usePipelineStateManager(pipelineId?: string): PipelineStateManager {
  const store = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalState, setOriginalState] = useState<PipelineConfiguration | null>(null)

  const loadPipeline = useCallback(
    async (pipeline: Pipeline) => {
      setIsLoading(true)
      setError(null)

      try {
        // Reset all stores first
        store.resetAllPipelineState('', true)

        // Hydrate all stores with pipeline data
        hydrateKafkaConnection(pipeline)
        hydrateKafkaTopics(pipeline)
        hydrateClickhouseConnection(pipeline)
        hydrateClickhouseDestination(pipeline)
        hydrateJoinConfiguration(pipeline)

        // Store original state for comparison
        setOriginalState(extractCurrentConfiguration())

        setIsLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pipeline')
        setIsLoading(false)
      }
    },
    [store],
  )

  const hasChanges = useCallback(() => {
    if (!originalState) return false
    const currentConfig = extractCurrentConfiguration()
    return JSON.stringify(currentConfig) !== JSON.stringify(originalState)
  }, [originalState])

  const resetToOriginal = useCallback(() => {
    if (originalState) {
      store.resetAllPipelineState('', true)
      hydrateFromConfiguration(originalState)
    }
  }, [originalState, store])

  // ... other methods
}
```

#### 1.2 Create Helper Functions

**File**: `src/utils/pipeline-configuration-builder.ts`

**Purpose**: Extract current configuration from all stores and map between store state and pipeline configuration.

### Phase 2: Core PipelineStateManager (1-2 days)

#### 2.1 Create PipelineStateManager Hook

**File**: `src/store/pipeline-state-manager.ts`

**Key Features**:

- Journey-specific behavior (creation vs editing)
- Instance management
- Simple creation workflow
- Complex editing workflow with hydration

**Implementation**:

```typescript
export function usePipelineStateManager(pipelineId?: string): PipelineStateManager {
  const [currentInstance, setCurrentInstance] = useState<PipelineStoreInstance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalState, setOriginalState] = useState<PipelineConfiguration | null>(null)

  // 🎯 SIMPLE: Creation journey
  const switchToCreation = useCallback(() => {
    const instance = pipelineStoreFactory.createInstance('creation')
    setCurrentInstance(instance)

    // Just reset to clean state - no hydration needed
    const store = instance.store.getState()
    store.resetAllPipelineState('', true)
  }, [])

  // 🎯 COMPLEX: Editing journey with hydration
  const switchToEditing = useCallback(async (pipelineId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const instance = pipelineStoreFactory.createInstance('editing', pipelineId)
      setCurrentInstance(instance)

      // Load pipeline data
      const pipeline = await fetchPipeline(pipelineId)

      // Hydrate the instance's store
      const store = instance.store.getState()
      store.resetAllPipelineState('', true)

      hydrateKafkaConnection(pipeline, store)
      hydrateKafkaTopics(pipeline, store)
      hydrateClickhouseConnection(pipeline, store)
      hydrateClickhouseDestination(pipeline, store)
      hydrateJoinConfiguration(pipeline, store)

      // Store original state for change tracking
      setOriginalState(extractCurrentConfiguration(store))

      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline')
      setIsLoading(false)
    }
  }, [])

  // ... other methods
}
```

#### 2.2 Create Helper Functions

**File**: `src/utils/pipeline-configuration-builder.ts`

**Purpose**: Extract current configuration from all stores and map between store state and pipeline configuration.

### Phase 3: Dependency Management (1 day)

#### 3.1 Add Dependency Tracking

**Enhance PipelineStateManager with**:

- Step dependency configuration
- Automatic invalidation logic (editing only)
- Validation state management

#### 3.2 Create Validation Helpers

**File**: `src/utils/pipeline-change-detector.ts`

**Purpose**: Detect and report changes between current and original states.

### Phase 4: UI Integration (1-2 days)

#### 4.1 Update PipelineWizard (Simple)

**File**: `src/modules/PipelineWizard.tsx`

**Enhancements**:

- Use journey-aware hook
- Simplified creation workflow
- No change tracking or hydration complexity

#### 4.2 Update PipelineDetailsModule (Complex)

**File**: `src/modules/pipelines/[id]/PipelineDetailsModule.tsx`

**Enhancements**:

- Use journey-aware hook
- Handle hydration and loading states
- Display change indicators
- Show validation status for all steps
- Provide save/discard actions

#### 4.3 Update StandaloneStepRenderer

**File**: `src/modules/StandaloneStepRenderer.tsx`

**Enhancements**:

- Journey-aware step rendering
- Dependency-aware editing (editing only)
- Validation status display
- Change notification handling

#### 4.4 Update Step Components

**Enhancements**:

- Add `onStepChange` callback
- Display validation status
- Handle edit mode properly

### Phase 5: Testing & Polish (1 day)

#### 5.1 Add Error Handling

- Comprehensive error messages
- Retry mechanisms
- User-friendly error display

#### 5.2 Add Loading States

- Progress indicators
- Disabled states during operations
- Loading spinners

#### 5.3 Journey Navigation

- Seamless switching between creation and editing
- Progress preservation
- Clear journey indicators

## 🎯 User Experience Improvements

### 1. Journey Separation

**Before**: Same store used for creation and editing, causing conflicts
**After**: Separate store instances for each journey, true isolation

```typescript
// Creation: Simple, clean workflow
const creationManager = usePipelineStateManager()
creationManager.switchToCreation() // Fresh store, no hydration

// Editing: Complex workflow with change tracking
const editingManager = usePipelineStateManager(pipelineId)
await editingManager.switchToEditing(pipelineId) // Hydration, change tracking
```

### 2. Progress Preservation

**Before**: Switching between creation and editing loses progress
**After**: Each journey preserves its own progress independently

```typescript
// User can switch between journeys without losing progress
const { startCreation, startEditing, getJourneyInfo } = usePipelineJourney()

// Switch to creation (preserves editing progress)
startCreation()

// Switch back to editing (preserves creation progress)
startEditing(pipelineId)
```

### 3. Change Tracking (Editing Only)

**Before**: No indication of changes made
**After**: Clear visual indicators showing what has changed

```typescript
// Example UI (editing journey only)
{pipelineManager.hasChanges() && (
  <div className="bg-yellow-50 border border-yellow-200 p-4 mb-4 rounded">
    <p className="font-medium text-yellow-800">Pipeline Modified</p>
    <button onClick={pipelineManager.resetToOriginal}>Discard Changes</button>
    <button onClick={pipelineManager.savePipeline}>Save Changes</button>
  </div>
)}
```

### 4. Dependency Awareness (Editing Only)

**Before**: Users don't know why steps are invalid
**After**: Clear explanation of dependencies and invalidation

```typescript
// Example UI (editing journey only)
{invalidatedSteps.length > 0 && (
  <div className="bg-yellow-50 border border-yellow-200 p-4 mb-4 rounded">
    <p className="text-yellow-800 font-medium">Dependent Steps Invalidated</p>
    <ul>
      {invalidatedSteps.map(step => (
        <li key={step}>{getStepDisplayName(step)}</li>
      ))}
    </ul>
  </div>
)}
```

### 5. Journey Indicators

**Before**: No clear indication of current mode
**After**: Clear journey indicators and navigation

```typescript
// Creation journey indicator
{journeyInfo.isCreation && (
  <div className="bg-blue-50 p-2 mb-4 rounded">
    <p className="text-blue-800 text-sm">Creating new pipeline</p>
  </div>
)}

// Editing journey indicator
{journeyInfo.isEditing && (
  <div className="bg-green-50 p-2 mb-4 rounded">
    <p className="text-green-800 text-sm">Editing pipeline {journeyInfo.pipelineId}</p>
  </div>
)}
```

### 6. Safe Editing

**Before**: Changes immediately applied, hard to undo
**After**: Changes tracked, easy to discard or save

```typescript
// Example: One-click reset (editing only)
pipelineManager.resetToOriginal() // Restores original state
```

## 🔧 Technical Implementation Details

### Journey-Specific State Management

#### Creation Journey (Simple)

1. **Initialize**: Create fresh store instance
2. **Configure**: Step-by-step configuration building
3. **Validate**: Simple validation for completeness
4. **Save**: Create new pipeline

#### Editing Journey (Complex)

1. **Load Pipeline**:
   - Create store instance for specific pipeline
   - Reset all stores
   - Hydrate with pipeline data
   - Store original state for change tracking

2. **Make Changes**:
   - User modifies configuration
   - Changes tracked in stores
   - Dependent steps automatically invalidated

3. **Save Changes**:
   - Extract current configuration
   - Send to backend
   - Update original state

4. **Discard Changes**:
   - Reset stores to original state
   - Clear invalidation tracking

### Store Instance Management

1. **Instance Creation**:
   - Factory creates separate instances for each journey
   - Creation: `creation-${timestamp}`
   - Editing: `editing-${pipelineId}`

2. **Instance Lifecycle**:
   - Automatic cleanup of old instances (30 minutes)
   - Progress preservation across navigation
   - Memory management

3. **Instance Isolation**:
   - No state pollution between journeys
   - Independent validation and change tracking
   - Separate error handling

### Dependency Management (Editing Only)

1. **Step Change Detection**:
   - Monitor store changes
   - Trigger invalidation for dependent steps
   - Update validation state

2. **Validation Tracking**:
   - Track which steps are invalid
   - Provide reasons for invalidation
   - Allow reset of invalidated steps

### Error Handling Strategy

1. **Loading Errors**: Display error message, allow retry
2. **Save Errors**: Show error, keep changes for user to fix
3. **Validation Errors**: Highlight invalid steps, provide guidance
4. **Journey Errors**: Handle journey transition failures

## 📊 Success Metrics

### Functional Requirements

- [ ] Users can create new pipelines (simple workflow)
- [ ] Users can edit existing pipelines (complex workflow)
- [ ] Changes are tracked and can be discarded (editing only)
- [ ] Dependent steps are automatically invalidated (editing only)
- [ ] Users can see validation status of all steps
- [ ] Users can save or discard changes easily
- [ ] Users can switch between creation and editing without losing progress

### User Experience Requirements

- [ ] No more than 2 clicks to discard all changes
- [ ] Clear indication of what has changed (editing only)
- [ ] Clear explanation of why steps are invalid (editing only)
- [ ] Loading states for all operations
- [ ] Error messages for failed operations
- [ ] Clear journey indicators and navigation

### Technical Requirements

- [ ] Backward compatibility with existing components
- [ ] No performance degradation
- [ ] Comprehensive error handling
- [ ] Type safety throughout
- [ ] Testable architecture
- [ ] Memory management for store instances
- [ ] Journey isolation and progress preservation

## 🚨 Risks & Mitigation

### Risk 1: Breaking Existing Functionality

**Mitigation**: Implement incrementally, maintain backward compatibility

### Risk 2: Performance Impact

**Mitigation**: Optimize state comparisons, use memoization

### Risk 3: Complex State Synchronization

**Mitigation**: Centralize state management, clear data flow

### Risk 4: User Confusion

**Mitigation**: Clear UI indicators, helpful error messages

## 📝 Future Enhancements

### Phase 2 Features (Future)

- **Undo/Redo**: Step-by-step undo functionality
- **Change Preview**: Preview of how changes will affect pipeline
- **Validation Rules**: Custom validation rules per step
- **Auto-save**: Automatic saving of changes
- **Conflict Resolution**: Handle concurrent editing

## 🔗 Related Files

### Core Implementation

- `src/store/pipeline-state-manager.ts` - Main state manager
- `src/utils/pipeline-configuration-builder.ts` - Configuration helpers
- `src/utils/pipeline-change-detector.ts` - Change detection

### UI Components

- `src/modules/pipelines/[id]/PipelineDetailsModule.tsx` - Main pipeline view
- `src/modules/StandaloneStepRenderer.tsx` - Step editing interface
- `src/modules/PipelineWizard.tsx` - Pipeline creation (minimal changes)

### Store Integration

- `src/store/index.ts` - Main store (minimal changes)
- `src/store/hydration/*.ts` - Existing hydration functions (reused)

## 📋 Development Checklist

### Phase 1: Store Instance Factory ✅

- [x] Create PipelineStoreFactory class
- [x] Implement instance creation and management
- [x] Add instance lifecycle management
- [x] Add automatic cleanup functionality
- [x] Create journey-aware hook (usePipelineJourney)

### Phase 2: Core PipelineStateManager ✅

- [x] Create PipelineStateManager hook
- [x] Implement switchToCreation method (simple)
- [x] Implement switchToEditing method (complex with hydration)
- [x] Implement savePipeline method
- [x] Implement hasChanges method (journey-specific)
- [x] Implement resetToOriginal method (editing only)
- [x] Add error handling
- [x] Add loading states

### Phase 3: Dependency Management ✅

- [x] Define step dependencies configuration (using existing state-machine)
- [x] Implement invalidateStep method (editing only)
- [x] Implement getStepValidation method
- [x] Implement getInvalidatedSteps method
- [x] Add validation state tracking
- [x] Integrate with existing DistributedValidationEngine
- [x] Create enhanced PipelineStateManager with dependency management
- [x] Create enhanced journey hook with dependency helpers
- [x] Create comprehensive test component

### Phase 4: UI Integration

- [x] Update PipelineWizard (simplified for creation)
  - [x] Integrate usePipelineJourneyEnhanced hook
  - [x] Add journey-aware step rendering
  - [x] Add dependency management integration
  - [x] Create integration test page
- [x] Update KafkaConnectionContainer (journey-aware)
  - [x] Add journey-aware props
  - [x] Add editing mode indicators
  - [x] Add change tracking display
- [ ] Update PipelineDetailsModule (complex for editing)
- [ ] Update StandaloneStepRenderer (journey-aware)
- [ ] Update other step components
- [ ] Add comprehensive journey testing
- [ ] Add validation display
- [ ] Add journey indicators

### Phase 5: Testing & Polish

- [ ] Add comprehensive tests
- [ ] Add error handling
- [ ] Add loading states
- [ ] Performance optimization
- [ ] Memory management testing
- [ ] Journey navigation testing
- [ ] Documentation updates

## 🎯 Conclusion

This refactor addresses the core complexity issues in pipeline editing by introducing a **Store Instance Factory Pattern** that provides true isolation between creation and editing journeys. The architecture separates concerns effectively:

- **Creation Journey**: Simple, clean workflow without hydration complexity
- **Editing Journey**: Complex workflow with hydration, change tracking, and dependency management

### Key Benefits

1. **True Isolation**: Separate store instances prevent state pollution
2. **Progress Preservation**: Users can switch between journeys without losing progress
3. **Simplified Creation**: Creation workflow is much simpler and more maintainable
4. **Complex Editing**: Editing complexity is contained where it belongs
5. **Better UX**: Clear journey indicators and seamless navigation

### Implementation Approach

The implementation is designed to be **incremental and safe**, allowing for gradual adoption and testing throughout the development process. The factory pattern ensures backward compatibility while providing the foundation for future enhancements.

This approach solves the original problem of editing complexity while making the overall system more maintainable and user-friendly.
