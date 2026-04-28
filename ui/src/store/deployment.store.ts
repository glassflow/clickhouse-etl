/**
 * deployment.store.ts — A6: Deployment State
 *
 * Captures the runtime/deployment state of a pipeline — separate from
 * design-time configuration held in `domainStore`.
 *
 * Fields mirror the backend response shape for pipeline status.
 */

import { StateCreator } from 'zustand'

export interface DeploymentState {
  pipeline_id: string | null
  pipeline_status: 'stopped' | 'running' | 'error' | 'starting' | 'stopping' | null
  version: number | null
  created_at: string | null
  updated_at: string | null
}

export interface DeploymentActions {
  setDeploymentState: (state: Partial<DeploymentState>) => void
  reset: () => void
}

export interface DeploymentSlice {
  deploymentStore: DeploymentState & DeploymentActions
}

const initialDeploymentState: DeploymentState = {
  pipeline_id: null,
  pipeline_status: null,
  version: null,
  created_at: null,
  updated_at: null,
}

export const createDeploymentSlice: StateCreator<DeploymentSlice> = (set) => ({
  deploymentStore: {
    ...initialDeploymentState,

    setDeploymentState: (partial: Partial<DeploymentState>) =>
      set((state) => ({
        deploymentStore: {
          ...state.deploymentStore,
          ...partial,
        },
      })),

    reset: () =>
      set((state) => ({
        deploymentStore: {
          ...state.deploymentStore,
          ...initialDeploymentState,
        },
      })),
  },
})
