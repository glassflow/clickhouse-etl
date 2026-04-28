import { StepKeys } from '@/src/config/constants'
import { STEP_REGISTRY } from '@/src/config/step-registry'
import type { ComponentType } from 'react'

/**
 * Configuration for each step in the step renderer
 */
export interface StepConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
  title: string
  description: string
  /**
   * Optional guard function - if returns false, step should be closed
   */
  guard?: () => boolean
}

/**
 * Step renderer configuration map
 * Maps StepKeys to their component, title, and description.
 * Derived from STEP_REGISTRY — edit src/config/step-registry.ts to change per-step values.
 *
 * Steps with no standalone panel (REVIEW_CONFIGURATION, DEPLOY_PIPELINE, OTLP_SIGNAL_TYPE)
 * have `component: null` in the registry and map to `undefined` here.
 */
export const STEP_RENDERER_CONFIG: Record<StepKeys, StepConfig | undefined> = (() => {
  const map = {} as Record<StepKeys, StepConfig | undefined>

  for (const descriptor of STEP_REGISTRY) {
    if (descriptor.component === null) {
      map[descriptor.key] = undefined
    } else {
      map[descriptor.key] = {
        component: descriptor.component,
        title: descriptor.editTitle ?? descriptor.title,
        description: descriptor.description ?? '',
        ...(descriptor.guard ? { guard: descriptor.guard } : {}),
      }
    }
  }

  return map
})()

/**
 * Get step configuration by step key
 * Returns undefined if step is not configured or guard fails
 */
export function getStepConfig(stepKey: StepKeys): StepConfig | undefined {
  const config = STEP_RENDERER_CONFIG[stepKey]
  if (!config) return undefined

  // Check guard if present
  if (config.guard && !config.guard()) {
    return undefined
  }

  return config
}
