import { z } from 'zod'

const optionalString = z.string().optional().or(z.literal(''))

const resourceListSchema = z.object({
  cpu: optionalString,
  memory: optionalString,
})

const storageSchema = z.object({
  size: optionalString,
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
  maxAge: optionalString,
  maxBytes: optionalString,
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
