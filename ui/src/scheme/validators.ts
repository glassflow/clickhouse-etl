import {
  KafkaConnectionFormSchema,
  AvailableTopicsSchema,
  OperationsSelectedSchema,
  DeduplicationConfigSchema,
  JoinConfigSchema,
  KafkaTopicsSchema,
} from '@/src/scheme'

import { StepKeys } from '@/src/config/constants'

// Define validation functions for each step
export const validators = {
  // Step 1: Kafka Connection
  validateKafkaConnection: (data: unknown) => {
    const result = KafkaConnectionFormSchema.safeParse(data)
    return {
      success: result.success,
      errors: result.success ? null : result.error.format(),
    }
  },

  // Step 2: Topic Selection
  validateSelectedTopics: (data: unknown) => {
    const result = KafkaTopicsSchema.safeParse(data)
    return {
      success: result.success,
      errors: result.success ? null : result.error.format(),
    }
  },

  // Step 3: Operations Selection
  validateOperationsSelected: (data: unknown) => {
    const result = OperationsSelectedSchema.safeParse(data)
    return {
      success: result.success,
      errors: result.success ? null : result.error.format(),
    }
  },

  // Step 4: Deduplication Configuration
  validateDeduplicationConfig: (data: unknown) => {
    const result = DeduplicationConfigSchema.safeParse(data)
    return {
      success: result.success,
      errors: result.success ? null : result.error.format(),
    }
  },

  // Step 5: Join Configuration
  validateJoinConfig: (data: unknown) => {
    const result = JoinConfigSchema.safeParse(data)
    return {
      success: result.success,
      errors: result.success ? null : result.error.format(),
    }
  },
}

// Helper function to validate current step
export function validateStep(stepName: string, data: unknown) {
  switch (stepName) {
    case StepKeys.KAFKA_CONNECTION:
      return validators.validateKafkaConnection(data)
    case StepKeys.TOPIC_SELECTION_1:
    case StepKeys.TOPIC_SELECTION_2:
      return validators.validateSelectedTopics(data)
    case StepKeys.DEDUPLICATION_CONFIGURATOR:
      return validators.validateDeduplicationConfig(data)
    case StepKeys.JOIN_CONFIGURATOR:
      return validators.validateJoinConfig(data)
    default:
      return { success: false, errors: { _errors: ['Unknown step'] } }
  }
}

export type ValidateStepType = (
  stepName: string,
  data: unknown,
) => {
  success: boolean
  errors: Record<string, string> | null
}
