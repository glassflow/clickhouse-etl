import { StateCreator } from 'zustand'

export interface StepsStoreProps {
  activeStepId: string | null
  completedStepIds: string[]
  /**
   * When the user navigates backwards to edit a previously-completed step,
   * this stores the step they were editing so we can "resume" forward on Continue.
   */
  resumeStepId: string | null
}
export interface StepsStore extends StepsStoreProps {
  // actions
  setActiveStepId: (id: string | null) => void
  setCompletedStepIds: (ids: string[]) => void
  addCompletedStepId: (id: string) => void
  setResumeStepId: (id: string | null) => void
  clearResumeStepId: () => void
  /** Remove from completedStepIds all ids that appear after the given instanceId in the journey order. */
  removeCompletedStepsAfterId: (instanceId: string, journeyInstanceIds: string[]) => void

  // reset steps store
  resetStepsStore: () => void
}

export interface StepsSlice {
  stepsStore: StepsStore
}

export const initialStepsStore: StepsStoreProps = {
  activeStepId: null,
  completedStepIds: [],
  resumeStepId: null,
}

export const createStepsSlice: StateCreator<StepsSlice> = (set) => ({
  stepsStore: {
    ...initialStepsStore,

    // actions
    setActiveStepId: (id: string | null) =>
      set((state) => ({
        stepsStore: { ...state.stepsStore, activeStepId: id },
      })),
    setCompletedStepIds: (ids: string[]) =>
      set((state) => ({
        stepsStore: { ...state.stepsStore, completedStepIds: ids },
      })),

    addCompletedStepId: (id: string) => {
      set((state) => {
        if (!state.stepsStore.completedStepIds.includes(id)) {
          return {
            stepsStore: {
              ...state.stepsStore,
              completedStepIds: [...state.stepsStore.completedStepIds, id],
            },
          }
        }
        return state
      })
    },

    setResumeStepId: (id: string | null) =>
      set((state) => ({
        stepsStore: { ...state.stepsStore, resumeStepId: id },
      })),

    clearResumeStepId: () =>
      set((state) => ({
        stepsStore: { ...state.stepsStore, resumeStepId: null },
      })),

    removeCompletedStepsAfterId: (instanceId: string, journeyInstanceIds: string[]) => {
      set((state) => {
        const idx = journeyInstanceIds.indexOf(instanceId)
        if (idx === -1) return state
        const idsToKeep = state.stepsStore.completedStepIds.filter((id) => {
          const journeyIdx = journeyInstanceIds.indexOf(id)
          return journeyIdx !== -1 && journeyIdx <= idx
        })
        return {
          stepsStore: { ...state.stepsStore, completedStepIds: idsToKeep },
        }
      })
    },

    // reset steps store
    resetStepsStore: () => set((state) => ({ stepsStore: { ...state.stepsStore, ...initialStepsStore } })),
  },
})
