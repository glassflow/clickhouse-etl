import { StateCreator } from 'zustand'

// Define DeduplicationConfig locally to avoid import issues
export interface DeduplicationConfig {
  enabled: boolean
  key: string
  keyType: string
  window: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
}

export interface TopicData {
  index: number
  name: string
  initialOffset: 'earliest' | 'latest'
  events: Array<{
    event: any
    topicIndex: number
    position: 'earliest' | 'latest'
    isManualEvent?: boolean
  }>
  selectedEvent: {
    event: any
    topicIndex: number
    position: 'earliest' | 'latest'
    isManualEvent?: boolean
  }
}

export interface TopicSelectionDraftState {
  // Draft data
  draftTopics: Record<number, TopicData>
  draftDeduplication: Record<number, DeduplicationConfig>

  // Original data (for reverting)
  originalTopics: Record<number, TopicData>
  originalDeduplication: Record<number, DeduplicationConfig>

  // Edit mode state
  isEditing: boolean
  editingStep: string | null

  // Actions
  loadDraft: (
    stepType: string,
    actualTopics: Record<number, TopicData>,
    actualDeduplication: Record<number, DeduplicationConfig>,
  ) => void
  updateDraftTopic: (index: number, topicData: TopicData) => void
  updateDraftDeduplication: (index: number, deduplicationConfig: DeduplicationConfig) => void
  commitDraft: () => { topics: Record<number, TopicData>; deduplication: Record<number, DeduplicationConfig> }
  discardDraft: () => void
  resetDraft: () => void

  // Enhanced helper methods
  getEffectiveTopic: (index: number) => TopicData | undefined
  getEffectiveDeduplication: (index: number) => DeduplicationConfig | undefined
  hasDraftChanges: () => boolean
  getDraftChanges: () => { topics: Record<number, TopicData>; deduplication: Record<number, DeduplicationConfig> }
}

export interface TopicSelectionDraftSlice {
  topicSelectionDraft: TopicSelectionDraftState
}

export const createTopicSelectionDraftSlice: StateCreator<TopicSelectionDraftSlice> = (set, get) => ({
  topicSelectionDraft: {
    draftTopics: {},
    draftDeduplication: {},
    originalTopics: {},
    originalDeduplication: {},
    isEditing: false,
    editingStep: null,

    loadDraft: (stepType, actualTopics, actualDeduplication) => {
      console.log('🏪 Draft Store: loadDraft called', { stepType, actualTopics, actualDeduplication })
      set((state) => {
        const newState = {
          topicSelectionDraft: {
            ...state.topicSelectionDraft,
            draftTopics: { ...actualTopics },
            draftDeduplication: { ...actualDeduplication },
            originalTopics: { ...actualTopics },
            originalDeduplication: { ...actualDeduplication },
            isEditing: true,
            editingStep: stepType,
          },
        }
        console.log('🏪 Draft Store: new state after loadDraft', newState.topicSelectionDraft)
        return newState
      })
    },

    updateDraftTopic: (index, topicData) => {
      set((state) => ({
        topicSelectionDraft: {
          ...state.topicSelectionDraft,
          draftTopics: {
            ...state.topicSelectionDraft.draftTopics,
            [index]: topicData,
          },
        },
      }))
    },

    updateDraftDeduplication: (index, deduplicationConfig) => {
      set((state) => ({
        topicSelectionDraft: {
          ...state.topicSelectionDraft,
          draftDeduplication: {
            ...state.topicSelectionDraft.draftDeduplication,
            [index]: deduplicationConfig,
          },
        },
      }))
    },

    commitDraft: () => {
      const state = get()
      const { draftTopics, draftDeduplication } = state.topicSelectionDraft

      // Reset editing state
      set((state) => ({
        topicSelectionDraft: {
          ...state.topicSelectionDraft,
          isEditing: false,
          editingStep: null,
        },
      }))

      return {
        topics: { ...draftTopics },
        deduplication: { ...draftDeduplication },
      }
    },

    discardDraft: () => {
      const state = get()
      const { originalTopics, originalDeduplication } = state.topicSelectionDraft

      set((state) => ({
        topicSelectionDraft: {
          ...state.topicSelectionDraft,
          draftTopics: { ...originalTopics },
          draftDeduplication: { ...originalDeduplication },
          isEditing: false,
          editingStep: null,
        },
      }))
    },

    resetDraft: () => {
      console.log('🧹 Draft Store: resetDraft called')
      set((state) => ({
        topicSelectionDraft: {
          ...state.topicSelectionDraft,
          draftTopics: {},
          draftDeduplication: {},
          originalTopics: {},
          originalDeduplication: {},
          isEditing: false,
          editingStep: null,
        },
      }))
    },

    // Enhanced helper methods
    getEffectiveTopic: (index) => {
      const state = get()
      const { isEditing, draftTopics, originalTopics } = state.topicSelectionDraft
      return isEditing ? draftTopics[index] : originalTopics[index]
    },

    getEffectiveDeduplication: (index) => {
      const state = get()
      const { isEditing, draftDeduplication, originalDeduplication } = state.topicSelectionDraft
      return isEditing ? draftDeduplication[index] : originalDeduplication[index]
    },

    hasDraftChanges: () => {
      const state = get()
      const { draftTopics, draftDeduplication, originalTopics, originalDeduplication } = state.topicSelectionDraft

      const topicsChanged = JSON.stringify(draftTopics) !== JSON.stringify(originalTopics)
      const deduplicationChanged = JSON.stringify(draftDeduplication) !== JSON.stringify(originalDeduplication)

      return topicsChanged || deduplicationChanged
    },

    getDraftChanges: () => {
      const state = get()
      const { draftTopics, draftDeduplication } = state.topicSelectionDraft
      return {
        topics: { ...draftTopics },
        deduplication: { ...draftDeduplication },
      }
    },
  },
})
