import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { PipelineJourney } from './pipeline-state-manager'
import { createKafkaSlice } from './kafka.store'
import { createClickhouseConnectionSlice } from './clickhouse-connection.store'
import { createClickhouseDestinationSlice } from './clickhouse-destination.store'
import { createStepsSlice } from './steps.store'
import { createTopicsSlice } from './topics.store'
import { createDeduplicationSlice } from './deduplication.store'
import { createJoinSlice } from './join.store'
import { createPipelineConfigSlice } from './pipeline-config'

export interface PipelineStoreInstance {
  id: string
  journey: PipelineJourney
  pipelineId?: string
  store: any // Will be properly typed when we integrate with Zustand
  createdAt: Date
  lastAccessed: Date
}

export class PipelineStoreFactory {
  private instances: Map<string, PipelineStoreInstance> = new Map()

  createInstance(journey: PipelineJourney, pipelineId?: string): PipelineStoreInstance {
    const instanceId = this.generateInstanceId(journey, pipelineId)

    // Check if instance already exists
    const existingInstance = this.instances.get(instanceId)
    if (existingInstance) {
      // Update last accessed time
      existingInstance.lastAccessed = new Date()
      return existingInstance
    }

    // Create new instance
    const newInstance: PipelineStoreInstance = {
      id: instanceId,
      journey,
      pipelineId,
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
        console.log(`Cleaned up old instance: ${id}`)
      }
    }
  }

  private generateInstanceId(journey: PipelineJourney, pipelineId?: string): string {
    if (journey === 'creation') {
      return `creation-${Date.now()}`
    } else {
      return `editing-${pipelineId || 'unknown'}`
    }
  }

  private createStoreInstance(journey: PipelineJourney): any {
    // Create a fresh Zustand store instance
    return create(
      devtools(
        (set, get, store) => {
          // Create all slices
          const kafkaSlice = createKafkaSlice(set, get, store)
          const clickhouseConnectionSlice = createClickhouseConnectionSlice(set, get, store)
          const clickhouseDestinationSlice = createClickhouseDestinationSlice(set, get, store)
          const stepsSlice = createStepsSlice(set, get, store)
          const topicsSlice = createTopicsSlice(set, get, store)
          const deduplicationSlice = createDeduplicationSlice(set, get, store)
          const joinSlice = createJoinSlice(set, get, store)
          const pipelineConfigSlice = createPipelineConfigSlice(set, get, store)

          return {
            // All the existing slices
            ...kafkaSlice,
            ...clickhouseConnectionSlice,
            ...clickhouseDestinationSlice,
            ...stepsSlice,
            ...topicsSlice,
            ...deduplicationSlice,
            ...joinSlice,
            ...pipelineConfigSlice,

            // Journey-specific initialization
            journey,

            // Global reset function
            resetAllPipelineState: (operation: string, force = false) => {
              const state = get() as any
              const currentConfig = state.configStore
              const topicCount = (state.configStore as any).getTopicCountForOperation?.(operation) || 1

              if (force || (currentConfig.isDirty && operation !== currentConfig.operationsSelected.operation)) {
                set((state: any) => ({
                  configStore: {
                    ...state.configStore,
                    operationsSelected: {
                      operation: operation,
                    },
                    outboundEventPreview: {
                      events: [],
                    },
                    isDirty: false,
                  },
                  topicsStore: {
                    ...state.topicsStore,
                    topics: {},
                    topicCount: topicCount,
                    availableTopics: state.topicsStore.availableTopics,
                  },
                  deduplicationStore: {
                    ...state.deduplicationStore,
                    deduplicationConfigs: {},
                  },
                  joinStore: {
                    ...state.joinStore,
                    enabled: false,
                    type: 'temporal',
                    streams: [],
                  },
                  clickhouseDestination: {
                    scheme: '',
                    database: '',
                    table: '',
                    destinationColumns: [],
                    mapping: [],
                  },
                  activeStep: 'kafka-connection',
                  completedSteps: ['kafka-connection'],
                }))
              } else {
                set((state: any) => ({
                  configStore: {
                    ...state.configStore,
                    operationsSelected: {
                      operation: operation,
                    },
                  },
                }))
              }
            },
          }
        },
        {
          name: `pipeline-store-${journey}`,
          enabled: process.env.NODE_ENV !== 'production',
        },
      ),
    )
  }

  // Get all instances for debugging
  getAllInstances(): PipelineStoreInstance[] {
    return Array.from(this.instances.values())
  }

  // Get instance count for monitoring
  getInstanceCount(): { creation: number; editing: number; total: number } {
    const instances = this.getAllInstances()
    const creation = instances.filter((i) => i.journey === 'creation').length
    const editing = instances.filter((i) => i.journey === 'editing').length

    return {
      creation,
      editing,
      total: instances.length,
    }
  }

  // Force cleanup all instances (for testing)
  cleanupAllInstances(): void {
    this.instances.clear()
    console.log('Cleaned up all instances')
  }
}

// Create a singleton instance
export const pipelineStoreFactory = new PipelineStoreFactory()

// Auto-cleanup every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(
    () => {
      pipelineStoreFactory.cleanupOldInstances()
    },
    30 * 60 * 1000,
  ) // 30 minutes
}
