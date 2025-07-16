import { StateCreator } from 'zustand'

export interface StepsStoreProps {
  activeStep: string
  completedSteps: string[]
  editingStep: string
}
export interface StepsStore extends StepsStoreProps {
  // actions
  setActiveStep: (step: string) => void
  setCompletedSteps: (steps: string[]) => void
  addCompletedStep: (step: string) => void
  removeCompletedStepsAfter: (step: string) => void
  setEditingStep: (step: string) => void

  // reset steps store
  resetStepsStore: () => void
}

export interface StepsSlice {
  stepsStore: StepsStore
}

export const initialStepsStore: StepsStoreProps = {
  activeStep: '',
  completedSteps: [],
  editingStep: '',
}

export const createStepsSlice: StateCreator<StepsSlice> = (set) => ({
  stepsStore: {
    ...initialStepsStore,

    // actions
    setActiveStep: (step: string) =>
      set((state) => ({
        stepsStore: { ...state.stepsStore, activeStep: step },
      })),
    setCompletedSteps: (steps: string[]) => {
      set((state) => ({
        stepsStore: {
          ...state.stepsStore,
          completedSteps: steps,
        },
      }))
    },

    addCompletedStep: (step: string) => {
      set((state) => {
        if (!state.stepsStore.completedSteps.includes(step)) {
          return {
            stepsStore: {
              ...state.stepsStore,
              completedSteps: [...state.stepsStore.completedSteps, step],
            },
          }
        }
        return state
      })
    },

    removeCompletedStepsAfter: (step: string) => {
      set((state) => {
        const stepIndex = state.stepsStore.completedSteps.indexOf(step)
        if (stepIndex !== -1) {
          // Keep all steps up to and including the given step
          return {
            stepsStore: {
              ...state.stepsStore,
              completedSteps: state.stepsStore.completedSteps.slice(0, stepIndex + 1),
            },
          }
        }
        return state
      })
    },

    setEditingStep: (step: string) => set((state) => ({ stepsStore: { ...state.stepsStore, editingStep: step } })),

    // reset steps store
    resetStepsStore: () => set((state) => ({ stepsStore: { ...state.stepsStore, ...initialStepsStore } })),
  },
})
