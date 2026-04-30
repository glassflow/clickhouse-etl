import { describe, it, expect } from 'vitest'
import { create } from 'zustand'
import { createAiUiSlice, type AiUiSlice, scopeKey } from './ai-ui.store'
import type { ChatMessage } from '@/src/modules/ai/types'

function makeStore() {
  return create<AiUiSlice>()((set, get, api) => ({
    ...createAiUiSlice(set, get, api),
  }))
}

const mkMsg = (id: string, role: ChatMessage['role'], text: string): ChatMessage => ({
  id,
  role,
  blocks: [{ kind: 'text', text }],
  createdAt: '2026-04-30T00:00:00Z',
})

describe('scopeKey', () => {
  it('global scope returns "global"', () => {
    expect(scopeKey({ kind: 'global' })).toBe('global')
  })

  it('pipeline scope returns the pipelineId', () => {
    expect(scopeKey({ kind: 'pipeline', pipelineId: 'p-123' })).toBe('p-123')
  })
})

describe('aiUiStore — drawer state', () => {
  it('opens, closes, and toggles', () => {
    const store = makeStore()
    expect(store.getState().aiUiStore.open).toBe(false)
    store.getState().aiUiStore.openDrawer()
    expect(store.getState().aiUiStore.open).toBe(true)
    store.getState().aiUiStore.closeDrawer()
    expect(store.getState().aiUiStore.open).toBe(false)
    store.getState().aiUiStore.toggleDrawer()
    expect(store.getState().aiUiStore.open).toBe(true)
  })

  it('openDrawer with scope sets both open and scope', () => {
    const store = makeStore()
    store.getState().aiUiStore.openDrawer({ kind: 'pipeline', pipelineId: 'p-9' })
    const s = store.getState().aiUiStore
    expect(s.open).toBe(true)
    expect(s.scope).toEqual({ kind: 'pipeline', pipelineId: 'p-9' })
  })
})

describe('aiUiStore — transcripts', () => {
  it('appendMessage adds to the keyed transcript', () => {
    const store = makeStore()
    store.getState().aiUiStore.appendMessage('global', mkMsg('u1', 'user', 'hi'))
    expect(store.getState().aiUiStore.transcripts['global']).toHaveLength(1)
  })

  it('setTranscript replaces the keyed transcript', () => {
    const store = makeStore()
    store
      .getState()
      .aiUiStore.setTranscript('global', [mkMsg('u1', 'user', 'a'), mkMsg('a1', 'assistant', 'b')])
    expect(store.getState().aiUiStore.transcripts['global']).toHaveLength(2)
    store.getState().aiUiStore.setTranscript('global', [])
    expect(store.getState().aiUiStore.transcripts['global']).toEqual([])
  })

  it('patchLastAssistant patches only the last assistant message', () => {
    const store = makeStore()
    store.getState().aiUiStore.setTranscript('p-1', [
      mkMsg('u1', 'user', 'q'),
      mkMsg('a1', 'assistant', 'first'),
      mkMsg('u2', 'user', 'q2'),
      mkMsg('a2', 'assistant', 'second'),
    ])
    store.getState().aiUiStore.patchLastAssistant('p-1', (m) => ({
      ...m,
      blocks: [{ kind: 'text', text: 'patched' }],
    }))
    const t = store.getState().aiUiStore.transcripts['p-1']
    expect(t[1].blocks).toEqual([{ kind: 'text', text: 'first' }])
    expect(t[3].blocks).toEqual([{ kind: 'text', text: 'patched' }])
  })

  it('patchLastAssistant is a no-op when no assistant message exists', () => {
    const store = makeStore()
    store.getState().aiUiStore.setTranscript('p-1', [mkMsg('u1', 'user', 'only')])
    store.getState().aiUiStore.patchLastAssistant('p-1', () => mkMsg('mut', 'assistant', 'x'))
    expect(store.getState().aiUiStore.transcripts['p-1']).toEqual([mkMsg('u1', 'user', 'only')])
  })

  it('transcripts are isolated per scope key', () => {
    const store = makeStore()
    store.getState().aiUiStore.appendMessage('global', mkMsg('g1', 'user', 'global'))
    store.getState().aiUiStore.appendMessage('p-7', mkMsg('p1', 'user', 'pipeline'))
    expect(store.getState().aiUiStore.transcripts['global']).toHaveLength(1)
    expect(store.getState().aiUiStore.transcripts['p-7']).toHaveLength(1)
    expect(store.getState().aiUiStore.transcripts['global'][0].id).toBe('g1')
  })
})
