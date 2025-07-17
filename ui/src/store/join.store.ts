import { StateCreator } from 'zustand'

export interface JoinStream {
  streamId: string
  topicName: string
  joinKey: string
  dataType: string
  joinTimeWindowValue: number
  joinTimeWindowUnit: string
  orientation: 'left' | 'right'
}

export interface JoinStoreProps {
  enabled: boolean
  type: string
  streams: JoinStream[]
}

export interface JoinStore extends JoinStoreProps {
  // actions
  setEnabled: (enabled: boolean) => void
  setType: (type: string) => void
  setStreams: (streams: JoinStream[]) => void
  getIsJoinDirty: () => boolean

  // reset join store
  resetJoinStore: () => void
}

export interface JoinSlice {
  joinStore: JoinStore
}

export const initialJoinStore: JoinStoreProps = {
  enabled: false,
  type: 'temporal',
  streams: [],
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
            topicName: stream.topicName,
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

    // reset join store
    resetJoinStore: () => set((state) => ({ joinStore: { ...state.joinStore, ...initialJoinStore } })),
  },
})
