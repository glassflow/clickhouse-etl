import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ConsumerTracker } from '../kafka-client'

// Mock Consumer interface matching KafkaJS
interface MockConsumer {
  disconnect: () => Promise<void>
}

function createMockConsumer(disconnectDelay = 0): MockConsumer {
  return {
    disconnect: vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        if (disconnectDelay > 0) {
          setTimeout(resolve, disconnectDelay)
        } else {
          resolve()
        }
      })
    }),
  }
}

describe('ConsumerTracker', () => {
  let tracker: ConsumerTracker

  beforeEach(() => {
    vi.useFakeTimers()
    tracker = new ConsumerTracker()
  })

  afterEach(() => {
    tracker.stop()
    vi.useRealTimers()
  })

  describe('track', () => {
    it('tracks a new consumer', () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')
      expect(tracker.count).toBe(1)
    })

    it('tracks multiple consumers', () => {
      const consumer1 = createMockConsumer()
      const consumer2 = createMockConsumer()
      const consumer3 = createMockConsumer()

      tracker.track('consumer-1', consumer1 as any, 'group-1', 'topic-1')
      tracker.track('consumer-2', consumer2 as any, 'group-2', 'topic-2')
      tracker.track('consumer-3', consumer3 as any, 'group-3', 'topic-3')

      expect(tracker.count).toBe(3)
    })

    it('overwrites existing consumer with same id', () => {
      const consumer1 = createMockConsumer()
      const consumer2 = createMockConsumer()

      tracker.track('consumer-1', consumer1 as any, 'group-1', 'topic-1')
      tracker.track('consumer-1', consumer2 as any, 'group-2', 'topic-2')

      expect(tracker.count).toBe(1)
    })
  })

  describe('untrack', () => {
    it('removes a tracked consumer', () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')
      expect(tracker.count).toBe(1)

      tracker.untrack('consumer-1')
      expect(tracker.count).toBe(0)
    })

    it('does nothing when untracking non-existent consumer', () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      tracker.untrack('consumer-2')
      expect(tracker.count).toBe(1)
    })
  })

  describe('markDisconnecting', () => {
    it('marks a consumer as disconnecting', () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      const disconnectPromise = Promise.resolve()
      tracker.markDisconnecting('consumer-1', disconnectPromise)

      // Consumer is still tracked
      expect(tracker.count).toBe(1)
    })

    it('does nothing when marking non-existent consumer', () => {
      const disconnectPromise = Promise.resolve()
      // Should not throw
      tracker.markDisconnecting('non-existent', disconnectPromise)
      expect(tracker.count).toBe(0)
    })
  })

  describe('forceDisconnect', () => {
    it('disconnects a tracked consumer', async () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      await tracker.forceDisconnect('consumer-1')

      expect(consumer.disconnect).toHaveBeenCalled()
      expect(tracker.count).toBe(0)
    })

    it('does nothing for non-existent consumer', async () => {
      await tracker.forceDisconnect('non-existent')
      expect(tracker.count).toBe(0)
    })

    it('waits for existing disconnect promise', async () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      let disconnectResolved = false
      const disconnectPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          disconnectResolved = true
          resolve()
        }, 100)
      })

      tracker.markDisconnecting('consumer-1', disconnectPromise)

      const forceDisconnectPromise = tracker.forceDisconnect('consumer-1')
      await vi.advanceTimersByTimeAsync(100)
      await forceDisconnectPromise

      expect(disconnectResolved).toBe(true)
      expect(tracker.count).toBe(0)
    })

    it('times out if disconnect takes too long', async () => {
      const consumer = createMockConsumer(5000) // 5 second delay
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      const forceDisconnectPromise = tracker.forceDisconnect('consumer-1')

      // Advance past the 2 second timeout
      await vi.advanceTimersByTimeAsync(2000)
      await forceDisconnectPromise

      // Consumer should be removed even if disconnect didn't complete
      expect(tracker.count).toBe(0)
    })

    it('handles disconnect errors gracefully', async () => {
      const consumer = createMockConsumer()
      ;(consumer.disconnect as any).mockRejectedValue(new Error('Disconnect failed'))

      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      // Should not throw
      await tracker.forceDisconnect('consumer-1')
      expect(tracker.count).toBe(0)
    })
  })

  describe('cleanupOrphanedConsumers', () => {
    it('cleans up consumers older than maxAge', async () => {
      const consumer1 = createMockConsumer()
      const consumer2 = createMockConsumer()

      tracker.track('consumer-1', consumer1 as any, 'group-1', 'topic-1')

      // Advance time past maxAge (60 seconds)
      vi.advanceTimersByTime(70000)

      // Track another consumer (this one is fresh)
      tracker.track('consumer-2', consumer2 as any, 'group-2', 'topic-2')

      await tracker.cleanupOrphanedConsumers()

      // Only the old consumer should be removed
      expect(consumer1.disconnect).toHaveBeenCalled()
      expect(consumer2.disconnect).not.toHaveBeenCalled()
      expect(tracker.count).toBe(1)
    })

    it('does not clean up consumers within maxAge', async () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      // Advance time but stay within maxAge
      vi.advanceTimersByTime(30000)

      await tracker.cleanupOrphanedConsumers()

      expect(consumer.disconnect).not.toHaveBeenCalled()
      expect(tracker.count).toBe(1)
    })

    it('cleans up all orphaned consumers', async () => {
      const consumer1 = createMockConsumer()
      const consumer2 = createMockConsumer()
      const consumer3 = createMockConsumer()

      tracker.track('consumer-1', consumer1 as any, 'group-1', 'topic-1')
      tracker.track('consumer-2', consumer2 as any, 'group-2', 'topic-2')
      tracker.track('consumer-3', consumer3 as any, 'group-3', 'topic-3')

      // Advance time past maxAge
      vi.advanceTimersByTime(70000)

      await tracker.cleanupOrphanedConsumers()

      expect(consumer1.disconnect).toHaveBeenCalled()
      expect(consumer2.disconnect).toHaveBeenCalled()
      expect(consumer3.disconnect).toHaveBeenCalled()
      expect(tracker.count).toBe(0)
    })
  })

  describe('cleanupAll', () => {
    it('disconnects all tracked consumers', async () => {
      const consumer1 = createMockConsumer()
      const consumer2 = createMockConsumer()

      tracker.track('consumer-1', consumer1 as any, 'group-1', 'topic-1')
      tracker.track('consumer-2', consumer2 as any, 'group-2', 'topic-2')

      await tracker.cleanupAll()

      expect(consumer1.disconnect).toHaveBeenCalled()
      expect(consumer2.disconnect).toHaveBeenCalled()
      expect(tracker.count).toBe(0)
    })

    it('stops the cleanup interval', async () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      await tracker.cleanupAll()

      // Advance time past cleanup interval (30 seconds)
      vi.advanceTimersByTime(35000)

      // Track a new consumer
      const consumer2 = createMockConsumer()
      tracker.track('consumer-2', consumer2 as any, 'group-2', 'topic-2')

      // Advance time past maxAge - cleanup should not run automatically
      vi.advanceTimersByTime(70000)

      // The new consumer should still be there since cleanup interval was stopped
      expect(tracker.count).toBe(1)
    })

    it('handles empty tracker', async () => {
      // Should not throw
      await tracker.cleanupAll()
      expect(tracker.count).toBe(0)
    })
  })

  describe('stop', () => {
    it('stops the cleanup interval', () => {
      tracker.stop()

      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      // Advance time past maxAge + cleanup interval
      vi.advanceTimersByTime(100000)

      // Consumer should still be there since periodic cleanup is stopped
      expect(tracker.count).toBe(1)
    })

    it('can be called multiple times safely', () => {
      // Should not throw
      tracker.stop()
      tracker.stop()
      tracker.stop()
    })
  })

  describe('count', () => {
    it('returns 0 for empty tracker', () => {
      expect(tracker.count).toBe(0)
    })

    it('returns correct count after tracking', () => {
      const consumer1 = createMockConsumer()
      const consumer2 = createMockConsumer()

      tracker.track('consumer-1', consumer1 as any, 'group-1', 'topic-1')
      expect(tracker.count).toBe(1)

      tracker.track('consumer-2', consumer2 as any, 'group-2', 'topic-2')
      expect(tracker.count).toBe(2)
    })

    it('returns correct count after untracking', () => {
      const consumer1 = createMockConsumer()
      const consumer2 = createMockConsumer()

      tracker.track('consumer-1', consumer1 as any, 'group-1', 'topic-1')
      tracker.track('consumer-2', consumer2 as any, 'group-2', 'topic-2')
      expect(tracker.count).toBe(2)

      tracker.untrack('consumer-1')
      expect(tracker.count).toBe(1)
    })
  })

  describe('periodic cleanup', () => {
    it('runs cleanup periodically (every 30 seconds)', async () => {
      const consumer = createMockConsumer()
      tracker.track('consumer-1', consumer as any, 'group-1', 'topic-1')

      // Advance time past maxAge (60 seconds) and cleanup interval (30 seconds)
      vi.advanceTimersByTime(60001)

      // Wait for the next cleanup cycle
      vi.advanceTimersByTime(30000)
      await Promise.resolve() // Let cleanup promises settle

      expect(consumer.disconnect).toHaveBeenCalled()
    })
  })
})
