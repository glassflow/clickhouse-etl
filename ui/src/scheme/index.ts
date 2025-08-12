import { z } from 'zod'

// import the schemas
import {
  ClickhouseConnectionFormSchema,
  ClickhouseConnectionFormType,
  ClickhouseDestinationSchema,
  ClickhouseDestinationType,
} from './clickhouse.scheme'
import {
  KafkaMetaFormSchema,
  KafkaBaseFormSchema,
  SaslPlainFormSchema,
  SaslJaasFormSchema,
  SaslGssapiFormSchema,
  SaslOauthbearerFormSchema,
  SaslScram256FormSchema,
  SaslScram512FormSchema,
  AwsIamFormSchema,
  DelegationTokensFormSchema,
  LdapFormSchema,
  MtlsFormSchema,
  TruststoreFormSchema,
  KafkaConnectionFormSchema,
  KafkaMetaFormType,
  KafkaBaseFormType,
  SaslPlainFormType,
  SaslJaasFormType,
  SaslGssapiFormType,
  SaslOauthbearerFormType,
  SaslScram256FormType,
  SaslScram512FormType,
  AwsIamFormType,
  DelegationTokensFormType,
  LdapFormType,
  MtlsFormType,
  TruststoreFormType,
  KafkaConnectionFormType,
} from './kafka.scheme'

import {
  KafkaEventSchema,
  KafkaTopicSchema,
  KafkaTopicsSchema,
  AvailableTopicsSchema,
  KafkaTopicDeduplicationSchema,

  // types
  KafkaEventType,
  KafkaTopicType,
  KafkaTopicsType,
  AvailableTopicsType,
  KafkaTopicDeduplicationType,
} from './topics.scheme'

// regular schemas - not part of the specific scheme
const OperationsSelected = z.object({
  operation: z.string(),
})

// TODO: remove this schema - it is not used anywhere
const DeduplicationConfigPerTopic = z.object({
  window: z.string(),
  windowUnit: z.string(),
  keys: z.array(z.string()),
})

const DeduplicationConfig = z.record(z.string(), DeduplicationConfigPerTopic)

const JoinConfig = z.object({
  join: z.boolean(),
  streams: z.array(
    z.object({
      name: z.string(),
      keys: z.array(
        z.object({
          key: z.string(),
          index: z.number(),
          type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
        }),
      ),
    }),
  ),
})

const OutboundEventPreview = z.object({
  events: z.array(z.record(z.string(), z.string())),
})

// extract the inferred type - for regular types
type OperationsSelected = z.infer<typeof OperationsSelected>
type DeduplicationConfig = z.infer<typeof DeduplicationConfig>
type JoinConfig = z.infer<typeof JoinConfig>

type OutboundEventPreview = z.infer<typeof OutboundEventPreview>

// Export the schemas (for validation)
export {
  OperationsSelected as OperationsSelectedSchema,
  DeduplicationConfig as DeduplicationConfigSchema,
  JoinConfig as JoinConfigSchema,
  OutboundEventPreview as OutboundEventPreviewSchema,

  // reexport the schemas - Kafka
  KafkaMetaFormSchema,
  KafkaBaseFormSchema,
  SaslPlainFormSchema,
  SaslJaasFormSchema,
  SaslGssapiFormSchema,
  SaslOauthbearerFormSchema,
  SaslScram256FormSchema,
  SaslScram512FormSchema,
  AwsIamFormSchema,
  DelegationTokensFormSchema,
  LdapFormSchema,
  MtlsFormSchema,
  TruststoreFormSchema,
  KafkaConnectionFormSchema,

  // reexport the schemas - Topics
  KafkaEventSchema,
  KafkaTopicSchema,
  KafkaTopicsSchema,
  AvailableTopicsSchema,
  KafkaTopicDeduplicationSchema,

  // reexport the schemas - Clickhouse
  ClickhouseConnectionFormSchema,
  ClickhouseDestinationSchema,
}

// Export the types (for TypeScript)
export type {
  OperationsSelected as OperationsSelectedType,
  DeduplicationConfig as DeduplicationConfigType,
  JoinConfig as JoinConfigType,
  OutboundEventPreview as OutboundEventPreviewType,

  // reexport the types - Kafka
  KafkaMetaFormType,
  KafkaBaseFormType,
  SaslPlainFormType,
  SaslJaasFormType,
  SaslGssapiFormType,
  SaslOauthbearerFormType,
  SaslScram256FormType,
  SaslScram512FormType,
  AwsIamFormType,
  DelegationTokensFormType,
  LdapFormType,
  MtlsFormType,
  TruststoreFormType,
  KafkaConnectionFormType,

  // reexport the types - Topics
  KafkaEventType,
  KafkaTopicType,
  KafkaTopicsType,
  AvailableTopicsType,
  KafkaTopicDeduplicationType,

  // reexport the types - Clickhouse
  ClickhouseDestinationType,
  ClickhouseConnectionFormType,
}
