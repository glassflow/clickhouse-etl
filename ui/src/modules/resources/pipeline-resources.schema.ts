import { z } from 'zod'
import {
  validateKubernetesQuantity,
  validateNatsMaxBytes,
  validateNatsMaxAge,
  HINT_REPLICAS,
} from './quantity-parser'

const optionalString = z.string().optional().or(z.literal(''))

const kubernetesQuantityOptional = optionalString.refine(
  (val) => !val || validateKubernetesQuantity(val).valid,
  (val) => {
    const result = validateKubernetesQuantity(val || '')
    return { message: result.valid ? 'Invalid format' : result.error }
  }
)

const natsMaxBytesOptional = optionalString.refine(
  (val) => !val || validateNatsMaxBytes(val).valid,
  (val) => {
    const result = validateNatsMaxBytes(val || '')
    return { message: result.valid ? 'Invalid format' : result.error }
  }
)

const natsMaxAgeOptional = optionalString.refine(
  (val) => !val || validateNatsMaxAge(val).valid,
  (val) => {
    const result = validateNatsMaxAge(val || '')
    return { message: result.valid ? 'Invalid format' : result.error }
  }
)

const resourceListSchema = z.object({
  cpu: kubernetesQuantityOptional,
  memory: kubernetesQuantityOptional,
})

const storageSchema = z.object({
  size: kubernetesQuantityOptional,
})

/** Replicas: optional positive integer (string or number). Rejects trailing junk (e.g. "1aaaaa"). */
const replicasOptional = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (val === undefined || val === null) return true
      if (typeof val === 'number') return Number.isInteger(val) && val >= 1
      const s = String(val).trim()
      if (s === '') return true
      // Only digits, no trailing letters or decimals
      if (!/^\d+$/.test(s)) return false
      const n = parseInt(s, 10)
      return n >= 1
    },
    { message: HINT_REPLICAS }
  )

const componentResourcesSchema = z.object({
  requests: resourceListSchema.optional(),
  limits: resourceListSchema.optional(),
  storage: storageSchema.optional(),
  replicas: replicasOptional,
})

const ingestorResourcesSchema = z.object({
  base: componentResourcesSchema.optional(),
  left: componentResourcesSchema.optional(),
  right: componentResourcesSchema.optional(),
})

const natsStreamSchema = z.object({
  maxAge: natsMaxAgeOptional,
  maxBytes: natsMaxBytesOptional,
})

const natsResourcesSchema = z.object({
  stream: natsStreamSchema.optional(),
})

export const pipelineResourcesFormSchema = z.object({
  nats: natsResourcesSchema.optional(),
  ingestor: ingestorResourcesSchema.optional(),
  join: componentResourcesSchema.optional(),
  sink: componentResourcesSchema.optional(),
  transform: componentResourcesSchema.optional(),
})

export type PipelineResourcesFormValues = z.infer<typeof pipelineResourcesFormSchema>
