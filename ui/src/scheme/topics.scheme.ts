import { union, z } from 'zod'

const KafkaEventSchema = z.object({
  event: z.any(),
  topicIndex: z.number(),
  position: union([z.number(), z.string()]), // can be earliest, latest, or a specific offset
  kafkaOffset: z.number().optional(),
  isAtEarliest: z.boolean().optional(),
  isAtLatest: z.boolean().optional(),
  isManualEvent: z.boolean().optional(),
})

// Schema field type for verified field types from KafkaTypeVerification
const KafkaFieldSchemaSchema = z.object({
  name: z.string(),
  type: z.string(), // user-selected type (or inferred if not changed)
  inferredType: z.string().optional(), // originally inferred type
  userType: z.string().optional(), // explicitly set by user (same as type when set)
  isManuallyAdded: z.boolean().optional(), // true for user-added fields (not inferred from event)
  isRemoved: z.boolean().optional(), // true for fields marked for removal (used during editing)
})

const KafkaTopicSchemaSchema = z.object({
  fields: z.array(KafkaFieldSchemaSchema),
})

const KafkaTopicSchema = z.object({
  name: z.string(), // name of the topic
  index: z.number(), // index of the topic in the topics array - joins have multiple topics
  events: z.array(KafkaEventSchema), // all events fetched previously including current event
  selectedEvent: KafkaEventSchema, // current event
  initialOffset: z.enum(['earliest', 'latest']), // current offset
  replicas: z.number().optional(), // number of replicas for this topic
  partitionCount: z.number().optional(), // number of partitions for this topic
  schema: KafkaTopicSchemaSchema.optional(), // verified field types from type verification step
})

const KafkaTopicsSchema = z.record(z.number(), KafkaTopicSchema)

const AvailableTopicsSchema = z.array(z.string())

const KafkaTopicDeduplicationSchema = z.object({
  enabled: z.boolean(),
  window: z.number(),
  unit: z.enum(['seconds', 'minutes', 'hours', 'days']),
  key: z.string(),
  keyType: z.string(),
})

const KafkaTopicSelectorSchema = z.object({
  topicName: z.string(),
  initialOffset: z.enum(['earliest', 'latest']),
})

const KafkaTopicSelectorWithEventSchema = KafkaTopicSelectorSchema.extend({
  event: KafkaEventSchema,
})

type KafkaEvent = z.infer<typeof KafkaEventSchema>
type KafkaTopic = z.infer<typeof KafkaTopicSchema>
type KafkaTopics = z.infer<typeof KafkaTopicsSchema>
type AvailableTopics = z.infer<typeof AvailableTopicsSchema>
type KafkaTopicDeduplication = z.infer<typeof KafkaTopicDeduplicationSchema>
type KafkaTopicSelector = z.infer<typeof KafkaTopicSelectorSchema>
type KafkaTopicSelectorWithEvent = z.infer<typeof KafkaTopicSelectorWithEventSchema>
type KafkaFieldSchema = z.infer<typeof KafkaFieldSchemaSchema>
type KafkaTopicSchemaType = z.infer<typeof KafkaTopicSchemaSchema>

export {
  KafkaEventSchema,
  KafkaTopicSchema,
  KafkaTopicsSchema,
  AvailableTopicsSchema,
  KafkaTopicDeduplicationSchema,
  KafkaTopicSelectorSchema,
  KafkaTopicSelectorWithEventSchema,
  KafkaFieldSchemaSchema,
  KafkaTopicSchemaSchema,
}

export type {
  KafkaEvent as KafkaEventType,
  KafkaTopic as KafkaTopicType,
  KafkaTopics as KafkaTopicsType,
  AvailableTopics as AvailableTopicsType,
  KafkaTopicDeduplication as KafkaTopicDeduplicationType,
  KafkaTopicSelector as KafkaTopicSelectorType,
  KafkaTopicSelectorWithEvent as KafkaTopicSelectorWithEventType,
  KafkaFieldSchema as KafkaFieldSchemaType,
  KafkaTopicSchemaType,
}
