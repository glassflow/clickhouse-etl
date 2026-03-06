import { StateCreator } from 'zustand'
import type { PipelineResources } from '@/src/types/pipeline'

export interface ResourcesSlice {
  resourcesStore: {
    pipeline_resources: PipelineResources | null
    fields_policy: { immutable: string[] }
    setResources: (resources: PipelineResources | null) => void
    setFieldsPolicy: (policy: { immutable: string[] }) => void
    hydrateResources: (resources: PipelineResources | null, immutable?: string[]) => void
    resetResources: () => void
  }
}

export const createResourcesSlice: StateCreator<ResourcesSlice> = (set) => ({
  resourcesStore: {
    pipeline_resources: null,
    fields_policy: { immutable: [] },

    setResources: (pipeline_resources) =>
      set((state) => ({
        resourcesStore: {
          ...state.resourcesStore,
          pipeline_resources,
        },
      })),

    setFieldsPolicy: (fields_policy) =>
      set((state) => ({
        resourcesStore: {
          ...state.resourcesStore,
          fields_policy,
        },
      })),

    hydrateResources: (pipeline_resources, immutable = []) =>
      set((state) => ({
        resourcesStore: {
          ...state.resourcesStore,
          pipeline_resources,
          fields_policy: { immutable },
        },
      })),

    resetResources: () =>
      set((state) => ({
        resourcesStore: {
          ...state.resourcesStore,
          pipeline_resources: null,
          fields_policy: { immutable: [] },
        },
      })),
  },
})
