'use client'

import { useState, useCallback } from 'react'
import { Pipeline } from '@/src/types/pipeline'
import { pipelineStoreFactory, PipelineStoreInstance } from './pipeline-store-factory-poc'
import { DistributedValidationEngine } from './state-machine/validation-engine'
import { DEPENDENCY_GRAPH } from './state-machine/dependency-graph'
import { StepKeys } from '@/src/config/constants'

// Types for journey management
export type PipelineJourney = 'creation' | 'editing'

export interface PipelineStateManager {
  // Core operations
  loadPipeline: (pipeline: Pipeline) => Promise<void>
  savePipeline: () => Promise<Pipeline>
  resetToOriginal: () => void
  hasChanges: () => boolean

  // State queries
  getCurrentState: () => any // PipelineConfiguration type
  getOriginalState: () => any // PipelineConfiguration type
  isLoading: boolean
  error: string | null

  // Instance management
  instanceId: string
  journey: PipelineJourney
  switchToCreation: () => void
  switchToEditing: (pipelineId: string) => Promise<void>
  getInstanceInfo: () => { id: string; journey: PipelineJourney; createdAt: Date }

  // Enhanced dependency management (editing only)
  invalidateStep: (stepKey: StepKeys, invalidatedBy?: string) => void
  getStepValidation: (stepKey: StepKeys) => { isValid: boolean; reason?: string; status: string }
  getInvalidatedSteps: () => StepKeys[]
  resetInvalidatedSteps: () => void
  onStepConfigured: (stepKey: StepKeys) => void
  onStepReset: (stepKey: StepKeys) => void
  getDependencyGraph: () => any
  getDependentSteps: (stepKey: StepKeys) => StepKeys[]
}

// Temporary mock for pipeline fetching - will be replaced with actual API call
const fetchPipeline = async (pipelineId: string): Promise<Pipeline> => {
  // TODO: Replace with actual API call
  return {
    id: pipelineId,
    name: 'Mock Pipeline',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: {
      type: 'kafka',
      provider: 'confluent',
      connection_params: {
        brokers: ['localhost:9092'],
        protocol: 'PLAINTEXT',
        mechanism: 'PLAIN',
      },
      topics: [],
    },
    sink: {
      type: 'clickhouse',
      provider: 'localhost',
      host: 'localhost',
      port: '9000',
      database: 'default',
      table: 'events',
      secure: false,
      max_batch_size: 1000,
      max_delay_time: '60s',
      table_mapping: [],
    },
    join: {
      enabled: false,
    },
    stats: {
      events_processed: 0,
      events_failed: 0,
      throughput_per_second: 0,
      last_event_processed: null,
    },
  }
}

// Temporary mock for pipeline creation - will be replaced with actual API call
const createPipeline = async (config: any): Promise<Pipeline> => {
  // TODO: Replace with actual API call
  return {
    id: 'new-pipeline-id',
    name: config.name || 'New Pipeline',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: config.source,
    sink: config.sink,
    join: config.join,
    stats: {
      events_processed: 0,
      events_failed: 0,
      throughput_per_second: 0,
      last_event_processed: null,
    },
  }
}

// Temporary mock for pipeline update - will be replaced with actual API call
const updatePipeline = async (pipelineId: string, config: any): Promise<Pipeline> => {
  // TODO: Replace with actual API call
  return {
    id: pipelineId,
    name: config.name || 'Updated Pipeline',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: config.source,
    sink: config.sink,
    join: config.join,
    stats: {
      events_processed: 0,
      events_failed: 0,
      throughput_per_second: 0,
      last_event_processed: null,
    },
  }
}

// Temporary helper to extract current configuration from store
const extractCurrentConfiguration = (store: any): any => {
  // TODO: Implement proper configuration extraction
  return {
    source: store.kafkaStore,
    sink: store.clickhouseConnectionStore,
    // Add other store slices as needed
  }
}

// Temporary helper to hydrate store from configuration
const hydrateFromConfiguration = (config: any, store: any): void => {
  // TODO: Implement proper hydration
  console.log('Hydrating store from configuration:', config)
}

export function usePipelineStateManagerEnhanced(pipelineId?: string): PipelineStateManager {
  const [currentInstance, setCurrentInstance] = useState<PipelineStoreInstance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalState, setOriginalState] = useState<any>(null)
  const [validationEngine, setValidationEngine] = useState<DistributedValidationEngine | null>(null)

  // 🎯 SIMPLE: Creation journey
  const switchToCreation = useCallback(() => {
    console.log('Switching to creation mode')

    // Create instance using factory
    const instance = pipelineStoreFactory.createInstance('creation')
    setCurrentInstance(instance)

    // Initialize validation engine
    const engine = new DistributedValidationEngine(instance.store, DEPENDENCY_GRAPH)
    setValidationEngine(engine)

    // Reset to clean state - no hydration needed
    const store = instance.store.getState()
    store.resetAllPipelineState('', true)
    setOriginalState(null) // No original state in creation mode
    setError(null)
  }, [])

  // 🎯 COMPLEX: Editing journey with hydration
  const switchToEditing = useCallback(async (pipelineId: string) => {
    console.log('Switching to editing mode for pipeline:', pipelineId)

    setIsLoading(true)
    setError(null)

    try {
      // Create instance using factory
      const instance = pipelineStoreFactory.createInstance('editing', pipelineId)
      setCurrentInstance(instance)

      // Initialize validation engine
      const engine = new DistributedValidationEngine(instance.store, DEPENDENCY_GRAPH)
      setValidationEngine(engine)

      // Load pipeline data
      const pipeline = await fetchPipeline(pipelineId)

      // Reset stores first
      const store = instance.store.getState()
      store.resetAllPipelineState('', true)

      // TODO: Implement proper hydration
      // For now, just store the pipeline data
      console.log('Loading pipeline for editing:', pipeline)

      // Store original state for change tracking
      const currentConfig = extractCurrentConfiguration(store)
      setOriginalState(currentConfig)

      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline')
      setIsLoading(false)
    }
  }, [])

  // 🎯 Load pipeline (for editing mode)
  const loadPipeline = useCallback(
    async (pipeline: Pipeline) => {
      if (!currentInstance || currentInstance.journey !== 'editing') {
        throw new Error('Not in editing mode')
      }

      setIsLoading(true)
      setError(null)

      try {
        // Reset stores first
        const store = currentInstance.store.getState()
        store.resetAllPipelineState('', true)

        // TODO: Implement proper hydration
        console.log('Loading pipeline:', pipeline)

        // Store original state for change tracking
        const currentConfig = extractCurrentConfiguration(store)
        setOriginalState(currentConfig)

        setIsLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pipeline')
        setIsLoading(false)
      }
    },
    [currentInstance],
  )

  // 🎯 Save pipeline (journey-specific)
  const savePipeline = useCallback(async (): Promise<Pipeline> => {
    if (!currentInstance) {
      throw new Error('No active pipeline instance')
    }

    setIsLoading(true)
    setError(null)

    try {
      const store = currentInstance.store.getState()
      const currentConfig = extractCurrentConfiguration(store)

      let result: Pipeline

      if (currentInstance.journey === 'creation') {
        // Create new pipeline
        result = await createPipeline(currentConfig)
      } else {
        // Update existing pipeline
        result = await updatePipeline(currentInstance.id.replace('editing-', ''), currentConfig)
      }

      // Update original state after successful save
      setOriginalState(currentConfig)

      setIsLoading(false)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pipeline')
      setIsLoading(false)
      throw err
    }
  }, [currentInstance])

  // 🎯 Check for changes (journey-specific)
  const hasChanges = useCallback(() => {
    if (!currentInstance) return false

    const store = currentInstance.store.getState()

    if (currentInstance.journey === 'creation') {
      // In creation mode, check if configuration is valid
      const currentConfig = extractCurrentConfiguration(store)
      return currentConfig && Object.keys(currentConfig).length > 0
    } else {
      // In editing mode, compare with original state
      if (!originalState) return false
      const currentConfig = extractCurrentConfiguration(store)
      return JSON.stringify(currentConfig) !== JSON.stringify(originalState)
    }
  }, [currentInstance, originalState])

  // 🎯 Reset to original (editing only)
  const resetToOriginal = useCallback(() => {
    if (!currentInstance || currentInstance.journey !== 'editing') return
    if (!originalState) return

    console.log('Resetting to original state')

    // Reset stores to original state
    const store = currentInstance.store.getState()
    store.resetAllPipelineState('', true)
    hydrateFromConfiguration(originalState, store)

    // Reset validation engine
    if (validationEngine) {
      validationEngine.resetAllValidations()
    }
  }, [currentInstance, originalState, validationEngine])

  // 🎯 Enhanced dependency management (editing only)
  const invalidateStep = useCallback(
    (stepKey: StepKeys, invalidatedBy?: string) => {
      if (!currentInstance || currentInstance.journey !== 'editing') return
      if (!validationEngine) return

      console.log('Invalidating step:', stepKey, 'by:', invalidatedBy)

      validationEngine.invalidateSection(stepKey, invalidatedBy || 'manual')
    },
    [currentInstance, validationEngine],
  )

  const getStepValidation = useCallback(
    (stepKey: StepKeys) => {
      if (!currentInstance || currentInstance.journey !== 'editing') {
        return { isValid: true, reason: undefined, status: 'not-applicable' }
      }

      if (!validationEngine) {
        return { isValid: false, reason: 'Validation engine not initialized', status: 'error' }
      }

      const validation = validationEngine.getSectionValidation(stepKey)

      // Handle the case where validation might be an array or object
      if (Array.isArray(validation)) {
        // If it's an array, take the first validation result
        const firstValidation = validation[0] || { status: 'not-configured' }
        return {
          isValid: firstValidation.status === 'valid',
          reason: (firstValidation as any).reason || undefined,
          status: firstValidation.status,
        }
      } else {
        // If it's a single validation object
        return {
          isValid: validation.status === 'valid',
          reason: (validation as any).reason || undefined,
          status: validation.status,
        }
      }
    },
    [currentInstance, validationEngine],
  )

  const getInvalidatedSteps = useCallback(() => {
    if (!validationEngine) return []

    // Get all steps and check their validation status
    const invalidatedSteps: StepKeys[] = []
    Object.values(StepKeys).forEach((stepKey) => {
      const validation = validationEngine.getSectionValidation(stepKey)

      // Handle the case where validation might be an array or object
      let status = 'not-configured'
      if (Array.isArray(validation)) {
        status = validation[0]?.status || 'not-configured'
      } else {
        status = validation.status || 'not-configured'
      }

      if (status === 'invalidated') {
        invalidatedSteps.push(stepKey)
      }
    })

    return invalidatedSteps
  }, [validationEngine])

  const resetInvalidatedSteps = useCallback(() => {
    if (!validationEngine) return

    validationEngine.resetAllValidations()
  }, [validationEngine])

  const onStepConfigured = useCallback(
    (stepKey: StepKeys) => {
      if (!validationEngine) return

      console.log('Step configured:', stepKey)
      validationEngine.onSectionConfigured(stepKey)
    },
    [validationEngine],
  )

  const onStepReset = useCallback(
    (stepKey: StepKeys) => {
      if (!validationEngine) return

      console.log('Step reset:', stepKey)
      validationEngine.onSectionReset(stepKey)
    },
    [validationEngine],
  )

  const getDependencyGraph = useCallback(() => {
    return DEPENDENCY_GRAPH
  }, [])

  const getDependentSteps = useCallback(
    (stepKey: StepKeys) => {
      if (!validationEngine) return []

      // This would need to be implemented in the validation engine
      // For now, return empty array
      return []
    },
    [validationEngine],
  )

  return {
    // Core operations
    loadPipeline,
    savePipeline,
    resetToOriginal,
    hasChanges,

    // State queries
    getCurrentState: () => {
      if (!currentInstance) return null
      const store = currentInstance.store.getState()
      return extractCurrentConfiguration(store)
    },
    getOriginalState: () => originalState,
    isLoading,
    error,

    // Instance management
    instanceId: currentInstance?.id || '',
    journey: currentInstance?.journey || 'creation',
    switchToCreation,
    switchToEditing,
    getInstanceInfo: () => ({
      id: currentInstance?.id || '',
      journey: currentInstance?.journey || 'creation',
      createdAt: currentInstance?.createdAt || new Date(),
    }),

    // Enhanced dependency management
    invalidateStep,
    getStepValidation,
    getInvalidatedSteps,
    resetInvalidatedSteps,
    onStepConfigured,
    onStepReset,
    getDependencyGraph,
    getDependentSteps,
  }
}
