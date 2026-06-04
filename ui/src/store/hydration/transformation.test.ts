import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/src/store'
import { hydrateTransformation } from './transformation'

describe('hydrateTransformation', () => {
  beforeEach(() => {
    useStore.getState().resetForNewPipeline(1)
  })

  describe('stateless_transformation passthrough detection', () => {
    it('treats a simple field name as a passthrough field', () => {
      hydrateTransformation({
        stateless_transformation: {
          type: 'expr_lang_transform',
          enabled: true,
          config: {
            transform: [{ expression: 'order_id', output_name: 'order_id', output_type: 'string' }],
          },
        },
      })

      const { fields } = useStore.getState().transformationStore.transformationConfig
      expect(fields).toHaveLength(1)
      expect(fields[0].type).toBe('passthrough')
      expect(fields[0].sourceField).toBe('order_id')
    })

    it('treats a dotted path (e.g. metadata.source) as a passthrough field, not a raw expression', () => {
      hydrateTransformation({
        stateless_transformation: {
          type: 'expr_lang_transform',
          enabled: true,
          config: {
            transform: [{ expression: 'metadata.source', output_name: 'source', output_type: 'string' }],
          },
        },
      })

      const { fields } = useStore.getState().transformationStore.transformationConfig
      expect(fields).toHaveLength(1)
      expect(fields[0].type).toBe('passthrough')
      expect(fields[0].sourceField).toBe('metadata.source')
    })

    it('treats a deeply nested path (e.g. a.b.c) as a passthrough field', () => {
      hydrateTransformation({
        stateless_transformation: {
          type: 'expr_lang_transform',
          enabled: true,
          config: {
            transform: [{ expression: 'a.b.c', output_name: 'c_val', output_type: 'string' }],
          },
        },
      })

      const { fields } = useStore.getState().transformationStore.transformationConfig
      expect(fields).toHaveLength(1)
      expect(fields[0].type).toBe('passthrough')
      expect(fields[0].sourceField).toBe('a.b.c')
    })

    it('still treats a function call as a computed field', () => {
      hydrateTransformation({
        stateless_transformation: {
          type: 'expr_lang_transform',
          enabled: true,
          config: {
            transform: [{ expression: 'toUpperCase(name)', output_name: 'name_upper', output_type: 'string' }],
          },
        },
      })

      const { fields } = useStore.getState().transformationStore.transformationConfig
      expect(fields).toHaveLength(1)
      expect(fields[0].type).toBe('computed')
    })
  })
})
