import { StateCreator } from 'zustand'

interface JoinStream {
  streamId: string
  joinKey: string
  dataType: string
  joinTimeWindowValue: number
  joinTimeWindowUnit: string
  orientation: 'left' | 'right'
}

export interface JoinSlice {
  joinStore: {
    enabled: boolean
    type: string
    streams: JoinStream[]
    setEnabled: (enabled: boolean) => void
    setType: (type: string) => void
    setStreams: (streams: JoinStream[]) => void
    getIsJoinDirty: () => boolean
  }
}

export const createJoinSlice: StateCreator<JoinSlice> = (set, get) => ({
  joinStore: {
    // state
    enabled: false,
    type: 'temporal',
    streams: [],

    // actions
    setEnabled: (enabled: boolean) => set((state) => ({ joinStore: { ...state.joinStore, enabled } })),
    setType: (type: string) => set((state) => ({ joinStore: { ...state.joinStore, type } })),
    setStreams: (streams: JoinStream[]) =>
      set((state) => ({
        joinStore: {
          ...state.joinStore,
          streams: streams.map((stream) => ({
            streamId: stream.streamId,
            joinKey: stream.joinKey,
            dataType: stream.dataType,
            joinTimeWindowValue: stream.joinTimeWindowValue,
            joinTimeWindowUnit: stream.joinTimeWindowUnit,
            orientation: stream.orientation,
          })),
        },
      })),
    getIsJoinDirty: () => {
      const { streams } = get().joinStore
      return streams.length > 0
    },
  },
})
