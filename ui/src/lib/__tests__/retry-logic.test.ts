import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { withRetry, isRetryableError, sleep, DEFAULT_RETRY_OPTIONS } from '../kafka-client'

describe('isRetryableError', () => {
  it('returns true when error message matches a pattern', () => {
    const error = new Error('Connection ECONNREFUSED to broker')
    const patterns = ['ECONNREFUSED', 'ETIMEDOUT']
    expect(isRetryableError(error, patterns)).toBe(true)
  })

  it('returns true when error name matches a pattern', () => {
    const error = new Error('Something went wrong')
    error.name = 'ECONNRESET'
    const patterns = ['ECONNRESET', 'ETIMEDOUT']
    expect(isRetryableError(error, patterns)).toBe(true)
  })

  it('returns false when error does not match any pattern', () => {
    const error = new Error('Invalid topic name')
    const patterns = ['ECONNREFUSED', 'ETIMEDOUT']
    expect(isRetryableError(error, patterns)).toBe(false)
  })

  it('returns false for empty patterns array', () => {
    const error = new Error('ECONNREFUSED')
    expect(isRetryableError(error, [])).toBe(false)
  })

  it('handles errors with undefined message', () => {
    const error = new Error()
    error.message = undefined as any
    const patterns = ['ECONNREFUSED']
    expect(isRetryableError(error, patterns)).toBe(false)
  })

  it('handles errors with undefined name', () => {
    const error = new Error('test')
    error.name = undefined as any
    const patterns = ['ECONNREFUSED']
    expect(isRetryableError(error, patterns)).toBe(false)
  })

  it('matches partial strings in error message', () => {
    const error = new Error('Failed: Request timed out after 30 seconds')
    const patterns = ['Request timed out']
    expect(isRetryableError(error, patterns)).toBe(true)
  })
})

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves after specified duration', async () => {
    const sleepPromise = sleep(1000)
    vi.advanceTimersByTime(1000)
    await expect(sleepPromise).resolves.toBeUndefined()
  })

  it('waits for exact duration', async () => {
    let resolved = false
    sleep(500).then(() => {
      resolved = true
    })

    vi.advanceTimersByTime(499)
    expect(resolved).toBe(false)

    vi.advanceTimersByTime(1)
    await Promise.resolve() // Flush microtasks
    expect(resolved).toBe(true)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('success scenarios', () => {
    it('returns result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('returns result after retries succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue('success')

      const retryPromise = withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        retryableErrors: ['ECONNREFUSED'],
      })

      // First retry delay
      await vi.advanceTimersByTimeAsync(100)
      // Second retry delay
      await vi.advanceTimersByTimeAsync(200)

      const result = await retryPromise
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('failure scenarios', () => {
    it('throws immediately for non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid configuration'))

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          retryableErrors: ['ECONNREFUSED'],
        }),
      ).rejects.toThrow('Invalid configuration')

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('throws after exhausting all retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

      const retryPromise = withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        retryableErrors: ['ECONNREFUSED'],
      })

      // First retry
      await vi.advanceTimersByTimeAsync(100)
      // Second retry
      await vi.advanceTimersByTimeAsync(200)

      await expect(retryPromise).rejects.toThrow('ECONNREFUSED')
      expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })

  describe('exponential backoff', () => {
    it('applies exponential backoff between retries', async () => {
      let callCount = 0
      const fn = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.reject(new Error('ECONNREFUSED'))
      })

      const retryPromise = withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        retryableErrors: ['ECONNREFUSED'],
      })

      // Initial call
      expect(callCount).toBe(1)

      // First retry after 100ms
      await vi.advanceTimersByTimeAsync(100)
      expect(callCount).toBe(2)

      // Second retry after 200ms
      await vi.advanceTimersByTimeAsync(200)
      expect(callCount).toBe(3)

      // Third retry after 400ms
      await vi.advanceTimersByTimeAsync(400)
      expect(callCount).toBe(4)

      await expect(retryPromise).rejects.toThrow('ECONNREFUSED')
    })

    it('respects maxDelayMs cap', async () => {
      let callCount = 0
      const fn = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.reject(new Error('ECONNREFUSED'))
      })

      const retryPromise = withRetry(fn, {
        maxRetries: 4,
        initialDelayMs: 100,
        maxDelayMs: 300,
        backoffMultiplier: 2,
        retryableErrors: ['ECONNREFUSED'],
      })

      // Initial call
      expect(callCount).toBe(1)

      // 100ms
      await vi.advanceTimersByTimeAsync(100)
      expect(callCount).toBe(2)

      // 200ms
      await vi.advanceTimersByTimeAsync(200)
      expect(callCount).toBe(3)

      // Would be 400ms, but capped to 300ms
      await vi.advanceTimersByTimeAsync(300)
      expect(callCount).toBe(4)

      // Still capped at 300ms
      await vi.advanceTimersByTimeAsync(300)
      expect(callCount).toBe(5)

      await expect(retryPromise).rejects.toThrow('ECONNREFUSED')
    })
  })

  describe('abort signal', () => {
    it('throws immediately when abort signal is already aborted', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const abortController = new AbortController()
      abortController.abort()

      await expect(withRetry(fn, {}, abortController.signal)).rejects.toThrow('Operation aborted')

      expect(fn).not.toHaveBeenCalled()
    })

    it('checks abort signal before each retry', async () => {
      let callCount = 0
      const fn = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.reject(new Error('ECONNREFUSED'))
      })
      const abortController = new AbortController()

      const retryPromise = withRetry(
        fn,
        {
          maxRetries: 5,
          initialDelayMs: 100,
          retryableErrors: ['ECONNREFUSED'],
        },
        abortController.signal,
      )

      // Initial attempt happens immediately
      expect(callCount).toBe(1)

      // Abort during the wait period (before retry happens)
      await vi.advanceTimersByTimeAsync(50)
      abortController.abort()
      await vi.advanceTimersByTimeAsync(50)

      await expect(retryPromise).rejects.toThrow('Operation aborted')
      // Only the initial attempt should have run
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('default options', () => {
    it('uses default retry options when none provided', async () => {
      let callCount = 0
      const fn = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.reject(new Error('ECONNREFUSED'))
      })

      const retryPromise = withRetry(fn)

      // Initial call happens immediately
      expect(callCount).toBe(1)

      // Default: 3 retries, 1000ms initial, 2x backoff
      await vi.advanceTimersByTimeAsync(1000) // First retry
      expect(callCount).toBe(2)

      await vi.advanceTimersByTimeAsync(2000) // Second retry
      expect(callCount).toBe(3)

      await vi.advanceTimersByTimeAsync(4000) // Third retry
      expect(callCount).toBe(4)

      await expect(retryPromise).rejects.toThrow('ECONNREFUSED')
      expect(fn).toHaveBeenCalledTimes(4) // Initial + 3 retries
    })

    it('retries on default retryable errors', async () => {
      const errorPatterns = DEFAULT_RETRY_OPTIONS.retryableErrors || []
      
      // Test just a few patterns to avoid timing issues
      const testPatterns = errorPatterns.slice(0, 3)
      
      for (const errorPattern of testPatterns) {
        vi.clearAllMocks()
        
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error(errorPattern))
          .mockResolvedValue('success')

        const retryPromise = withRetry(fn, {
          maxRetries: 1,
          initialDelayMs: 100,
        })

        await vi.advanceTimersByTimeAsync(100)

        const result = await retryPromise
        expect(result).toBe('success')
        expect(fn).toHaveBeenCalledTimes(2)
      }
    })
  })

  describe('error handling', () => {
    it('converts non-Error throws to Error objects', async () => {
      const fn = vi.fn().mockRejectedValue('string error')

      await expect(
        withRetry(fn, {
          maxRetries: 0,
          retryableErrors: [],
        }),
      ).rejects.toThrow('string error')
    })

    it('preserves original error after retries exhausted', async () => {
      const originalError = new Error('ECONNREFUSED: Connection refused')
      const fn = vi.fn().mockRejectedValue(originalError)

      const retryPromise = withRetry(fn, {
        maxRetries: 1,
        initialDelayMs: 100,
        retryableErrors: ['ECONNREFUSED'],
      })

      // Run all timers to completion
      await vi.runAllTimersAsync()

      await expect(retryPromise).rejects.toBe(originalError)
      expect(fn).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })
  })
})
