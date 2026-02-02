import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { StepKeys } from '@/src/config/constants'
import { useGetIndex } from './useGetIndex'

describe('useGetIndex', () => {
  it('returns 0 for TOPIC_SELECTION_1', () => {
    const { result } = renderHook(() => useGetIndex(StepKeys.TOPIC_SELECTION_1))
    expect(result.current()).toBe(0)
  })

  it('returns 0 for TOPIC_DEDUPLICATION_CONFIGURATOR_1', () => {
    const { result } = renderHook(() => useGetIndex(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1))
    expect(result.current()).toBe(0)
  })

  it('returns 1 for TOPIC_SELECTION_2', () => {
    const { result } = renderHook(() => useGetIndex(StepKeys.TOPIC_SELECTION_2))
    expect(result.current()).toBe(1)
  })

  it('returns 1 for TOPIC_DEDUPLICATION_CONFIGURATOR_2', () => {
    const { result } = renderHook(() => useGetIndex(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2))
    expect(result.current()).toBe(1)
  })

  it('returns 0 for empty string', () => {
    const { result } = renderHook(() => useGetIndex(''))
    expect(result.current()).toBe(0)
  })

  it('returns 0 for other step (e.g. KAFKA_CONNECTION)', () => {
    const { result } = renderHook(() => useGetIndex(StepKeys.KAFKA_CONNECTION))
    expect(result.current()).toBe(0)
  })
})
