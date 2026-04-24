import { STEP_REGISTRY } from './step-registry'
import { StepKeys } from './constants'

test('all StepKeys have a descriptor', () => {
  const registeredKeys = STEP_REGISTRY.map((d) => d.key)
  Object.values(StepKeys).forEach((key) => {
    expect(registeredKeys).toContain(key)
  })
})

test('no duplicate keys', () => {
  const keys = STEP_REGISTRY.map((d) => d.key)
  expect(keys.length).toBe(new Set(keys).size)
})

test('all dependsOn references point to registered keys', () => {
  const registeredKeys = new Set(STEP_REGISTRY.map((d) => d.key))
  STEP_REGISTRY.forEach((d) => {
    d.dependsOn?.forEach((dep) => {
      expect(registeredKeys.has(dep)).toBe(true)
    })
  })
})
