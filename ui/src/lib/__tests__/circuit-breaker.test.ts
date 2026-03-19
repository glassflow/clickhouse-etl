import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CircuitBreaker, CircuitState } from '../kafka-client'

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('starts in CLOSED state', () => {
      circuitBreaker = new CircuitBreaker()
      expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
    })

    it('starts with zero failures', () => {
      circuitBreaker = new CircuitBreaker()
      expect(circuitBreaker.failures).toBe(0)
    })

    it('uses default options when none provided', () => {
      circuitBreaker = new CircuitBreaker()
      // Default failureThreshold is 5
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure()
      }
      expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)
    })

    it('accepts custom options', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 5000,
        halfOpenMaxAttempts: 1,
      })
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)
    })
  })

  describe('canExecute', () => {
    it('returns true when circuit is CLOSED', () => {
      circuitBreaker = new CircuitBreaker()
      expect(circuitBreaker.canExecute()).toBe(true)
    })

    it('returns false when circuit is OPEN and timeout has not passed', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 10000,
      })
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)
      expect(circuitBreaker.canExecute()).toBe(false)
    })

    it('returns true when circuit is OPEN but timeout has passed (transitions to HALF_OPEN)', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 10000,
      })
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)

      // Advance time past the reset timeout
      vi.advanceTimersByTime(10001)

      expect(circuitBreaker.canExecute()).toBe(true)
      expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)
    })

    it('returns true in HALF_OPEN state when under max attempts', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
        halfOpenMaxAttempts: 2,
      })
      circuitBreaker.recordFailure()
      vi.advanceTimersByTime(1001)

      // First attempt
      expect(circuitBreaker.canExecute()).toBe(true)
      circuitBreaker.recordFailure()

      // Second attempt
      expect(circuitBreaker.canExecute()).toBe(true)
    })

    it('returns false in HALF_OPEN state when max attempts reached', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
        halfOpenMaxAttempts: 2,
      })
      circuitBreaker.recordFailure()
      vi.advanceTimersByTime(1001)

      // Use up all attempts
      circuitBreaker.canExecute()
      circuitBreaker.recordFailure()
      circuitBreaker.canExecute()
      circuitBreaker.recordFailure()

      expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)
      expect(circuitBreaker.canExecute()).toBe(false)
    })
  })

  describe('state transitions', () => {
    describe('CLOSED -> OPEN', () => {
      it('transitions after reaching failure threshold', () => {
        circuitBreaker = new CircuitBreaker({ failureThreshold: 3 })

        circuitBreaker.recordFailure()
        expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
        expect(circuitBreaker.failures).toBe(1)

        circuitBreaker.recordFailure()
        expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
        expect(circuitBreaker.failures).toBe(2)

        circuitBreaker.recordFailure()
        expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)
        expect(circuitBreaker.failures).toBe(3)
      })
    })

    describe('OPEN -> HALF_OPEN', () => {
      it('transitions when canExecute is called after timeout', () => {
        circuitBreaker = new CircuitBreaker({
          failureThreshold: 1,
          resetTimeoutMs: 5000,
        })
        circuitBreaker.recordFailure()
        expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)

        vi.advanceTimersByTime(5001)
        circuitBreaker.canExecute()

        expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)
      })
    })

    describe('HALF_OPEN -> CLOSED', () => {
      it('transitions on success', () => {
        circuitBreaker = new CircuitBreaker({
          failureThreshold: 1,
          resetTimeoutMs: 1000,
        })
        circuitBreaker.recordFailure()
        vi.advanceTimersByTime(1001)
        circuitBreaker.canExecute() // Transition to HALF_OPEN

        expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)

        circuitBreaker.recordSuccess()
        expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
        expect(circuitBreaker.failures).toBe(0)
      })
    })

    describe('HALF_OPEN -> OPEN', () => {
      it('transitions after max attempts with failures', () => {
        circuitBreaker = new CircuitBreaker({
          failureThreshold: 1,
          resetTimeoutMs: 1000,
          halfOpenMaxAttempts: 2,
        })
        circuitBreaker.recordFailure()
        vi.advanceTimersByTime(1001)
        circuitBreaker.canExecute() // Transition to HALF_OPEN

        // Exhaust half-open attempts
        circuitBreaker.recordFailure()
        circuitBreaker.recordFailure()

        expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)
      })
    })
  })

  describe('recordSuccess', () => {
    it('resets failure count in CLOSED state', () => {
      circuitBreaker = new CircuitBreaker({ failureThreshold: 5 })
      circuitBreaker.recordFailure()
      circuitBreaker.recordFailure()
      expect(circuitBreaker.failures).toBe(2)

      circuitBreaker.recordSuccess()
      expect(circuitBreaker.failures).toBe(0)
      expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
    })

    it('closes circuit when in HALF_OPEN state', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      })
      circuitBreaker.recordFailure()
      vi.advanceTimersByTime(1001)
      circuitBreaker.canExecute()

      expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)

      circuitBreaker.recordSuccess()
      expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
    })
  })

  describe('recordFailure', () => {
    it('increments failure count in CLOSED state', () => {
      circuitBreaker = new CircuitBreaker()
      expect(circuitBreaker.failures).toBe(0)

      circuitBreaker.recordFailure()
      expect(circuitBreaker.failures).toBe(1)

      circuitBreaker.recordFailure()
      expect(circuitBreaker.failures).toBe(2)
    })

    it('increments halfOpenAttempts in HALF_OPEN state', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
        halfOpenMaxAttempts: 3,
      })
      circuitBreaker.recordFailure()
      vi.advanceTimersByTime(1001)
      circuitBreaker.canExecute()

      expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)

      // Record failures but stay in HALF_OPEN
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)

      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)

      // Third failure should transition to OPEN
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)
    })
  })

  describe('getTimeUntilRetry', () => {
    it('returns 0 when circuit is CLOSED', () => {
      circuitBreaker = new CircuitBreaker()
      expect(circuitBreaker.getTimeUntilRetry()).toBe(0)
    })

    it('returns 0 when circuit is HALF_OPEN', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      })
      circuitBreaker.recordFailure()
      vi.advanceTimersByTime(1001)
      circuitBreaker.canExecute()

      expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)
      expect(circuitBreaker.getTimeUntilRetry()).toBe(0)
    })

    it('returns remaining time when circuit is OPEN', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 10000,
      })
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)

      // Immediately after failure
      expect(circuitBreaker.getTimeUntilRetry()).toBe(10000)

      // After 3 seconds
      vi.advanceTimersByTime(3000)
      expect(circuitBreaker.getTimeUntilRetry()).toBe(7000)

      // After 10 seconds total
      vi.advanceTimersByTime(7000)
      expect(circuitBreaker.getTimeUntilRetry()).toBe(0)
    })

    it('never returns negative values', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      })
      circuitBreaker.recordFailure()

      vi.advanceTimersByTime(5000) // Way past timeout
      expect(circuitBreaker.getTimeUntilRetry()).toBe(0)
    })
  })

  describe('reset', () => {
    it('resets circuit to initial state from CLOSED', () => {
      circuitBreaker = new CircuitBreaker()
      circuitBreaker.recordFailure()
      circuitBreaker.recordFailure()

      circuitBreaker.reset()

      expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
      expect(circuitBreaker.failures).toBe(0)
      expect(circuitBreaker.getTimeUntilRetry()).toBe(0)
    })

    it('resets circuit to initial state from OPEN', () => {
      circuitBreaker = new CircuitBreaker({ failureThreshold: 1 })
      circuitBreaker.recordFailure()
      expect(circuitBreaker.currentState).toBe(CircuitState.OPEN)

      circuitBreaker.reset()

      expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
      expect(circuitBreaker.failures).toBe(0)
    })

    it('resets circuit to initial state from HALF_OPEN', () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      })
      circuitBreaker.recordFailure()
      vi.advanceTimersByTime(1001)
      circuitBreaker.canExecute()
      expect(circuitBreaker.currentState).toBe(CircuitState.HALF_OPEN)

      circuitBreaker.reset()

      expect(circuitBreaker.currentState).toBe(CircuitState.CLOSED)
      expect(circuitBreaker.failures).toBe(0)
    })
  })
})
