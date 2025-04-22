import { StateCreator } from 'zustand'

export interface StepsSlice {
  activeStep: string
  setActiveStep: (step: string) => void
  completedSteps: string[]
  setCompletedSteps: (steps: string[]) => void
  addCompletedStep: (step: string) => void
  editingStep: string
  setEditingStep: (step: string) => void
}

export const createStepsSlice: StateCreator<StepsSlice> = (set) => ({
  activeStep: '',
  setActiveStep: (step: string) => set({ activeStep: step }),
  completedSteps: [] as string[],
  setCompletedSteps: (steps: string[]) => {
    set((state) => ({
      ...state,
      completedSteps: steps,
    }))
  },

  addCompletedStep: (step: string) => {
    set((state) => {
      if (!state.completedSteps.includes(step)) {
        return {
          ...state,
          completedSteps: [...state.completedSteps, step],
        }
      }
      return state
    })
  },
  editingStep: '',
  setEditingStep: (step: string) => set({ editingStep: step }),
})
