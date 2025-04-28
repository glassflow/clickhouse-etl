import { StateCreator } from 'zustand'

export interface StepsSlice {
  activeStep: string
  setActiveStep: (step: string) => void
  completedSteps: string[]
  setCompletedSteps: (steps: string[]) => void
  addCompletedStep: (step: string) => void
  removeCompletedStepsAfter: (step: string) => void
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

  removeCompletedStepsAfter: (step: string) => {
    set((state) => {
      const stepIndex = state.completedSteps.indexOf(step)
      console.log('stepIndex', stepIndex)
      console.log('completedSteps', state.completedSteps)
      if (stepIndex !== -1) {
        // Keep all steps up to and including the given step
        return {
          ...state,
          completedSteps: state.completedSteps.slice(0, stepIndex + 1),
        }
      }
      return state
    })
  },

  editingStep: '',
  setEditingStep: (step: string) => set({ editingStep: step }),
})
