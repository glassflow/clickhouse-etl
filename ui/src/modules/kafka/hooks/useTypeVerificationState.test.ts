import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTypeVerificationState } from './useTypeVerificationState'

describe('useTypeVerificationState', () => {
  describe('initialization', () => {
    it('builds fieldTypes from eventData with no schema: two entries with inferred types, canContinue true', () => {
      const eventData = { id: 1, name: 'a' }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic: undefined }))

      expect(result.current.fieldTypes.length).toBe(2)
      const names = result.current.fieldTypes.map((f) => f.name).sort()
      expect(names).toEqual(['id', 'name'])
      result.current.fieldTypes.forEach((f) => {
        expect(f.inferredType).toBeTruthy()
        expect(f.userType).toBeTruthy()
        expect(f.isManuallyAdded).toBe(false)
        expect(f.isRemoved).toBe(false)
      })
      expect(result.current.canContinue).toBe(true)
    })

    it('eventData null: fieldTypes becomes empty', () => {
      const { result, rerender } = renderHook(
        ({ eventData, topic }) => useTypeVerificationState({ eventData, topic }),
        { initialProps: { eventData: { id: 1 } as unknown, topic: undefined } },
      )
      expect(result.current.fieldTypes.length).toBeGreaterThan(0)

      rerender({ eventData: null, topic: undefined })
      expect(result.current.fieldTypes).toEqual([])
    })
  })

  describe('existing schema', () => {
    it('merges topic schema: userType override and isRemoved preserved', () => {
      const eventData = { id: 1, name: 'a' }
      const topic = {
        schema: {
          fields: [
            { name: 'id', userType: 'int64', inferredType: 'int32', isRemoved: false },
            { name: 'name', userType: 'string', isRemoved: true },
          ],
        },
      }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic }))

      const idField = result.current.fieldTypes.find((f) => f.name === 'id')
      expect(idField?.userType).toBe('int64')
      expect(idField?.isRemoved).toBe(false)

      const nameField = result.current.fieldTypes.find((f) => f.name === 'name')
      expect(nameField?.isRemoved).toBe(true)
    })

    it('adds manually added fields from schema not in event with inferredType "-"', () => {
      const eventData = { id: 1 }
      const topic = {
        schema: {
          fields: [
            { name: 'id', userType: 'int32' },
            { name: 'extra', userType: 'string', isManuallyAdded: true },
          ],
        },
      }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic }))

      const extraField = result.current.fieldTypes.find((f) => f.name === 'extra')
      expect(extraField).toBeDefined()
      expect(extraField?.inferredType).toBe('-')
      expect(extraField?.userType).toBe('string')
      expect(extraField?.isManuallyAdded).toBe(true)
    })
  })

  describe('handleTypeChange', () => {
    it('updates userType for the given field', () => {
      const eventData = { id: 1, name: 'a' }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic: undefined }))

      act(() => {
        result.current.handleTypeChange('id', 'int64')
      })

      const idField = result.current.fieldTypes.find((f) => f.name === 'id')
      expect(idField?.userType).toBe('int64')
    })
  })

  describe('handleAddField', () => {
    it('adds a new field with valid name and sets isManuallyAdded true', () => {
      const eventData = { id: 1 }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic: undefined }))

      act(() => {
        result.current.setNewFieldName('custom_field')
        result.current.setNewFieldType('string')
      })
      act(() => {
        result.current.handleAddField()
      })

      const added = result.current.fieldTypes.find((f) => f.name === 'custom_field')
      expect(added).toBeDefined()
      expect(added?.isManuallyAdded).toBe(true)
      expect(added?.inferredType).toBe('-')
      expect(added?.userType).toBe('string')
      expect(result.current.newFieldName).toBe('')
      expect(result.current.newFieldError).toBeNull()
    })

    it('sets newFieldError for duplicate name', () => {
      const eventData = { id: 1, name: 'a' }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic: undefined }))

      act(() => {
        result.current.setNewFieldName('name')
      })
      act(() => {
        result.current.handleAddField()
      })

      expect(result.current.newFieldError).toBe('A field with this name already exists')
    })

    it('sets newFieldError for empty name', () => {
      const eventData = { id: 1 }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic: undefined }))

      act(() => {
        result.current.setNewFieldName('   ')
        result.current.handleAddField()
      })

      expect(result.current.newFieldError).toBe('Field name cannot be empty')
    })

    it('sets newFieldError for invalid name (bad chars)', () => {
      const eventData = { id: 1 }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic: undefined }))

      act(() => {
        result.current.setNewFieldName('invalid-name-with-dash')
      })
      act(() => {
        result.current.handleAddField()
      })

      expect(result.current.newFieldError).toContain('letter or underscore')
    })
  })

  describe('handleRemoveField / handleRestoreField', () => {
    it('handleRemoveField marks non-manual field as isRemoved', () => {
      const eventData = { id: 1, name: 'a' }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic: undefined }))

      act(() => {
        result.current.handleRemoveField('name')
      })

      const nameField = result.current.fieldTypes.find((f) => f.name === 'name')
      expect(nameField?.isRemoved).toBe(true)
      expect(result.current.canContinue).toBe(true) // id still active
    })

    it('handleRemoveField removes manually added field entirely', () => {
      const eventData = { id: 1 }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic: undefined }))

      act(() => {
        result.current.setNewFieldName('extra')
        result.current.setNewFieldType('string')
      })
      act(() => {
        result.current.handleAddField()
      })
      expect(result.current.fieldTypes.find((f) => f.name === 'extra')).toBeDefined()
      const beforeCount = result.current.fieldTypes.length
      act(() => {
        result.current.handleRemoveField('extra')
      })
      expect(result.current.fieldTypes.find((f) => f.name === 'extra')).toBeUndefined()
      expect(result.current.fieldTypes.length).toBe(beforeCount - 1)
    })

    it('handleRestoreField sets isRemoved false; canContinue reflects active count', () => {
      const eventData = { id: 1, name: 'a' }
      const topic = { schema: { fields: [{ name: 'name', isRemoved: true }] } }
      const { result } = renderHook(() => useTypeVerificationState({ eventData, topic }))

      expect(result.current.canContinue).toBe(true) // id active
      act(() => {
        result.current.handleRemoveField('id')
      })
      expect(result.current.canContinue).toBe(false)

      act(() => {
        result.current.handleRestoreField('id')
      })
      const idField = result.current.fieldTypes.find((f) => f.name === 'id')
      expect(idField?.isRemoved).toBe(false)
      expect(result.current.canContinue).toBe(true)
    })
  })
})
