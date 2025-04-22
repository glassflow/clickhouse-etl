import { union, z } from 'zod'

const KafkaEventSchema = z.object({
  event: z.any(),
  topicIndex: z.number(),
  position: union([z.number(), z.string()]), // can be earliest, latest, or a specific offset
  kafkaOffset: z.number().optional(),
  isFromCache: z.boolean().optional(),
})

const KafkaTopicSchema = z.object({
  name: z.string(), // name of the topic
  index: z.number(), // index of the topic in the topics array - joins have multiple topics
  events: z.array(KafkaEventSchema), // all events fetched previously including current event
  selectedEvent: KafkaEventSchema, // current event
  initialOffset: z.enum(['earliest', 'latest']), // current offset
  deduplication: z
    .object({
      enabled: z.boolean(),
      window: z.number(),
      unit: z.enum(['seconds', 'minutes', 'hours', 'days']),
      key: z.string(),
      keyType: z.string(),
    })
    .optional(),
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

export {
  KafkaEventSchema,
  KafkaTopicSchema,
  KafkaTopicsSchema,
  AvailableTopicsSchema,
  KafkaTopicDeduplicationSchema,
  KafkaTopicSelectorSchema,
  KafkaTopicSelectorWithEventSchema,
}

export type {
  KafkaEvent as KafkaEventType,
  KafkaTopic as KafkaTopicType,
  KafkaTopics as KafkaTopicsType,
  AvailableTopics as AvailableTopicsType,
  KafkaTopicDeduplication as KafkaTopicDeduplicationType,
  KafkaTopicSelector as KafkaTopicSelectorType,
  KafkaTopicSelectorWithEvent as KafkaTopicSelectorWithEventType,
}
