// AI drawer UI state (Phase 4).
//
// The drawer is portal-mounted at the root layout and reachable from anywhere
// (D4). One transcript per scope (`'global'` for the new-pipeline chat, or a
// `pipelineId` for the per-pipeline chat) is the cross-cutting constraint #7.
//
// This slice owns:
// - drawer open/close
// - active scope (which transcript is visible)
// - selected model id + token-usage counter (UI display only)
// - transcripts keyed by scope-key (hydrated from /ui-api/ai/chats/:scope)
// - streaming flag (disables send while a response is in flight)

import { StateCreator } from 'zustand'
import type { ChatMessage } from '@/src/modules/ai/types'

export type AiScope = { kind: 'pipeline'; pipelineId: string } | { kind: 'global' }

export interface AiUiState {
  open: boolean
  scope: AiScope
  modelId: string
  tokensUsedThisSession: number
  transcripts: Record<string, ChatMessage[]> // keyed by scopeKey ('global' | pipelineId)
  streaming: boolean
}

export interface AiUiActions {
  openDrawer: (scope?: AiScope) => void
  closeDrawer: () => void
  toggleDrawer: () => void
  setScope: (scope: AiScope) => void
  setModel: (id: string) => void
  setTokensUsed: (n: number) => void
  setTranscript: (scopeKey: string, messages: ChatMessage[]) => void
  appendMessage: (scopeKey: string, message: ChatMessage) => void
  patchLastAssistant: (scopeKey: string, patch: (msg: ChatMessage) => ChatMessage) => void
  setStreaming: (b: boolean) => void
}

export interface AiUiSlice {
  aiUiStore: AiUiState & AiUiActions
}

/** Stable string key for a scope; matches the `scope_key` column in ai_chats. */
export const scopeKey = (scope: AiScope) => (scope.kind === 'global' ? 'global' : scope.pipelineId)

export const createAiUiSlice: StateCreator<AiUiSlice> = (set) => ({
  aiUiStore: {
    open: false,
    scope: { kind: 'global' },
    modelId: 'claude-haiku-4-5',
    tokensUsedThisSession: 0,
    transcripts: {},
    streaming: false,

    openDrawer: (scope) =>
      set((state) => ({
        aiUiStore: { ...state.aiUiStore, open: true, ...(scope ? { scope } : {}) },
      })),
    closeDrawer: () =>
      set((state) => ({ aiUiStore: { ...state.aiUiStore, open: false } })),
    toggleDrawer: () =>
      set((state) => ({ aiUiStore: { ...state.aiUiStore, open: !state.aiUiStore.open } })),
    setScope: (scope) =>
      set((state) => ({ aiUiStore: { ...state.aiUiStore, scope } })),
    setModel: (modelId) =>
      set((state) => ({ aiUiStore: { ...state.aiUiStore, modelId } })),
    setTokensUsed: (n) =>
      set((state) => ({ aiUiStore: { ...state.aiUiStore, tokensUsedThisSession: n } })),
    setTranscript: (key, messages) =>
      set((state) => ({
        aiUiStore: {
          ...state.aiUiStore,
          transcripts: { ...state.aiUiStore.transcripts, [key]: messages },
        },
      })),
    appendMessage: (key, message) =>
      set((state) => ({
        aiUiStore: {
          ...state.aiUiStore,
          transcripts: {
            ...state.aiUiStore.transcripts,
            [key]: [...(state.aiUiStore.transcripts[key] ?? []), message],
          },
        },
      })),
    patchLastAssistant: (key, patch) =>
      set((state) => {
        const existing = state.aiUiStore.transcripts[key] ?? []
        // Find the *last* assistant message — patch operates on it.
        let lastAssistantIdx = -1
        for (let i = existing.length - 1; i >= 0; i--) {
          if (existing[i].role === 'assistant') {
            lastAssistantIdx = i
            break
          }
        }
        if (lastAssistantIdx < 0) return state
        const next = [...existing]
        next[lastAssistantIdx] = patch(next[lastAssistantIdx])
        return {
          aiUiStore: {
            ...state.aiUiStore,
            transcripts: { ...state.aiUiStore.transcripts, [key]: next },
          },
        }
      }),
    setStreaming: (streaming) =>
      set((state) => ({ aiUiStore: { ...state.aiUiStore, streaming } })),
  },
})
