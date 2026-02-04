import { describe, it, expect } from 'vitest'
import {
  getPipelineStatusLabel,
  getPipelineStatusVariant,
  getPipelineStatusAccessibilityText,
} from './pipeline-status-display'

describe('pipeline-status-display', () => {
  describe('getPipelineStatusLabel', () => {
    it('returns label for active', () => {
      expect(getPipelineStatusLabel('active')).toBe('Active')
    })

    it('returns label for pausing', () => {
      expect(getPipelineStatusLabel('pausing')).toBe('Pausing...')
    })

    it('returns label for paused', () => {
      expect(getPipelineStatusLabel('paused')).toBe('Paused')
    })

    it('returns label for stopping', () => {
      expect(getPipelineStatusLabel('stopping')).toBe('Stopping...')
    })

    it('returns label for stopped', () => {
      expect(getPipelineStatusLabel('stopped')).toBe('Stopped')
    })

    it('returns label for failed', () => {
      expect(getPipelineStatusLabel('failed')).toBe('Failed')
    })

    it('returns Unknown status for unknown status', () => {
      expect(getPipelineStatusLabel('unknown' as any)).toBe('Unknown status')
    })
  })

  describe('getPipelineStatusVariant', () => {
    it('returns success for active', () => {
      expect(getPipelineStatusVariant('active')).toBe('success')
    })

    it('returns warning for transitional statuses', () => {
      expect(getPipelineStatusVariant('pausing')).toBe('warning')
      expect(getPipelineStatusVariant('paused')).toBe('warning')
      expect(getPipelineStatusVariant('resuming')).toBe('warning')
      expect(getPipelineStatusVariant('stopping')).toBe('warning')
      expect(getPipelineStatusVariant('terminating')).toBe('warning')
    })

    it('returns secondary for stopped and terminated', () => {
      expect(getPipelineStatusVariant('stopped')).toBe('secondary')
      expect(getPipelineStatusVariant('terminated')).toBe('secondary')
    })

    it('returns error for failed', () => {
      expect(getPipelineStatusVariant('failed')).toBe('error')
    })

    it('returns default for unknown status', () => {
      expect(getPipelineStatusVariant('unknown' as any)).toBe('default')
    })
  })

  describe('getPipelineStatusAccessibilityText', () => {
    it('returns accessibility text for active', () => {
      expect(getPipelineStatusAccessibilityText('active')).toBe('Pipeline is active')
    })

    it('returns accessibility text for pausing', () => {
      expect(getPipelineStatusAccessibilityText('pausing')).toBe('Pipeline is pausing')
    })

    it('returns accessibility text for paused', () => {
      expect(getPipelineStatusAccessibilityText('paused')).toBe('Pipeline is paused')
    })

    it('returns accessibility text for stopping', () => {
      expect(getPipelineStatusAccessibilityText('stopping')).toBe('Pipeline is stopping')
    })

    it('returns accessibility text for stopped', () => {
      expect(getPipelineStatusAccessibilityText('stopped')).toBe('Pipeline is stopped')
    })

    it('returns accessibility text for failed', () => {
      expect(getPipelineStatusAccessibilityText('failed')).toBe('Pipeline has failed')
    })

    it('returns Unknown status for unknown status', () => {
      expect(getPipelineStatusAccessibilityText('unknown' as any)).toBe('Unknown status')
    })
  })
})
