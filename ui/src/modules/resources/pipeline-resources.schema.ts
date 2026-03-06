import { z } from 'zod'
import {
  validateKubernetesQuantity,
  validateNatsMaxBytes,
  validateNatsMaxAge,
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

const componentResourcesSchema = z.object({
  requests: resourceListSchema.optional(),
  limits: resourceListSchema.optional(),
  storage: storageSchema.optional(),
  replicas: z.union([z.string(), z.number()]).optional().nullable(),
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
