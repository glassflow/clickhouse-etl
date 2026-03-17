import { StateCreator } from 'zustand'
import {
  AiSessionStatus,
  ChatMessage,
  DocHintItem,
  PipelineIntentModel,
  ProposedChange,
  DeepPartial,
} from '@/src/modules/ai/types'
import { v4 as uuidv4 } from 'uuid'

// ─── State shape ──────────────────────────────────────────────────────────────

export interface AiSessionStoreProps {
  sessionId: string | null
  status: AiSessionStatus
  messages: ChatMessage[]
  intent: PipelineIntentModel | null
  docHints: DocHintItem[]
  proposedChanges: ProposedChange[]
  /** Hash of intent at materialization time — used for stale detection */
  materializationHash: string | null
  error: string | null
  /** Passwords entered by the user — never sent to LLM, used only for connection testing */
  kafkaPassword: string | null
  clickhousePassword: string | null
}

export interface AiSessionStore extends AiSessionStoreProps {
  startAiSession(): void
  appendAiMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): void
  applyIntentDelta(delta: DeepPartial<PipelineIntentModel>): void
  setAiDocHints(items: DocHintItem[]): void
  setAiStatus(status: AiSessionStatus): void
  setAiError(error: string | null): void
  setMaterializationHash(hash: string | null): void
  setKafkaPassword(pwd: string): void
  setClickhousePassword(pwd: string): void
  clearAiSession(): void
}

export interface AiSessionSlice {
  aiSessionStore: AiSessionStore
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialAiSessionStore: AiSessionStoreProps = {
  sessionId: null,
  status: 'idle',
  messages: [],
  intent: null,
  docHints: [],
  proposedChanges: [],
  materializationHash: null,
  error: null,
  kafkaPassword: null,
  clickhousePassword: null,
}

// ─── Slice creator ────────────────────────────────────────────────────────────

export const createAiSessionSlice: StateCreator<AiSessionSlice> = (set, get) => ({
  aiSessionStore: {
    ...initialAiSessionStore,

    startAiSession: () => {
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          sessionId: uuidv4(),
          status: 'collecting',
          messages: [],
          intent: {
            topicCount: null,
            operationType: null,
            kafka: null,
            clickhouse: null,
            topics: [],
            destination: null,
            filter: null,
            mode: 'collecting',
            unresolvedQuestions: [],
          },
          docHints: [],
          proposedChanges: [],
          materializationHash: null,
          error: null,
        },
      }))
    },

    appendAiMessage: (msg) => {
      const message: ChatMessage = {
        id: uuidv4(),
        timestamp: Date.now(),
        ...msg,
      }
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          messages: [...state.aiSessionStore.messages, message],
        },
      }))
    },

    applyIntentDelta: (delta) => {
      set((state) => {
        const current = state.aiSessionStore.intent
        if (!current) return state
        const updated: PipelineIntentModel = deepMerge(current, delta) as PipelineIntentModel
        return {
          aiSessionStore: {
            ...state.aiSessionStore,
            intent: updated,
          },
        }
      })
    },

    setAiDocHints: (items) => {
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          docHints: items,
        },
      }))
    },

    setAiStatus: (status) => {
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          status,
        },
      }))
    },

    setAiError: (error) => {
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          error,
          status: error ? 'error' : state.aiSessionStore.status,
        },
      }))
    },

    setMaterializationHash: (hash) => {
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          materializationHash: hash,
        },
      }))
    },

    setKafkaPassword: (pwd) => {
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          kafkaPassword: pwd,
        },
      }))
    },

    setClickhousePassword: (pwd) => {
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          clickhousePassword: pwd,
        },
      }))
    },

    clearAiSession: () => {
      set((state) => ({
        aiSessionStore: {
          ...state.aiSessionStore,
          ...initialAiSessionStore,
        },
      }))
    },
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  if (source === null || source === undefined) return target
  if (typeof source !== 'object' || Array.isArray(source)) return source as T

  const result = { ...target } as any
  for (const key of Object.keys(source as object)) {
    const srcVal = (source as any)[key]
    const tgtVal = (target as any)[key]
    if (srcVal !== null && typeof srcVal === 'object' && !Array.isArray(srcVal) && tgtVal !== null && typeof tgtVal === 'object') {
      result[key] = deepMerge(tgtVal, srcVal)
    } else {
      result[key] = srcVal
    }
  }
  return result
}
