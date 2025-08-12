import { DependencyGraph } from './types'

const DEPENDENCY_GRAPH: DependencyGraph = {
  nodes: {
    // Operations
    deduplication: {
      id: 'deduplication',
      type: 'operation',
      dependencies: ['kafka-connection'],
      dependents: ['topic-selection', 'deduplication-configurator', 'clickhouse-connection', 'clickhouse-mapper'],
      resetMethod: 'resetOperationState',
    },
    joining: {
      id: 'joining',
      type: 'operation',
      dependencies: ['kafka-connection'],
      dependents: ['topic-selection', 'join-configurator', 'clickhouse-connection', 'clickhouse-mapper'],
      resetMethod: 'resetOperationState',
    },
    'deduplication-joining': {
      id: 'deduplication-joining',
      type: 'operation',
      dependencies: ['kafka-connection'],
      dependents: [
        'topic-selection',
        'deduplication-configurator',
        'join-configurator',
        'clickhouse-connection',
        'clickhouse-mapper',
      ],
      resetMethod: 'resetOperationState',
    },
    'ingest-only': {
      id: 'ingest-only',
      type: 'operation',
      dependencies: ['kafka-connection'],
      dependents: ['clickhouse-connection', 'clickhouse-mapper'],
      resetMethod: 'resetOperationState',
    },

    // Steps
    'kafka-connection': {
      id: 'kafka-connection',
      type: 'step',
      dependencies: [],
      dependents: ['topic-selection', 'deduplication-configurator', 'join-configurator', 'clickhouse-mapper'],
      resetMethod: 'resetKafkaConnection',
    },
    'topic-selection': {
      id: 'topic-selection',
      type: 'step',
      dependencies: ['kafka-connection'],
      dependents: ['join-configurator', 'clickhouse-mapper'],
      resetMethod: 'resetTopicSelection',
    },
    'deduplication-configurator': {
      id: 'deduplication-configurator',
      type: 'step',
      dependencies: [],
      dependents: [],
      resetMethod: 'resetDeduplicationConfig',
    },
    'join-configurator': {
      id: 'join-configurator',
      type: 'step',
      dependencies: [],
      dependents: ['clickhouse-mapper'],
      resetMethod: 'resetJoinConfig',
    },
    'clickhouse-connection': {
      id: 'clickhouse-connection',
      type: 'step',
      dependencies: ['kafka-connection', 'topic-selection', 'deduplication-configurator', 'join-configurator'],
      dependents: ['clickhouse-mapper'],
      resetMethod: 'resetClickhouseConnection',
    },
    'clickhouse-mapper': {
      id: 'clickhouse-mapper',
      type: 'step',
      dependencies: ['clickhouse-connection'],
      dependents: [],
      resetMethod: 'resetClickhouseMapper',
    },

    // Store Slices
    kafkaStore: {
      id: 'kafkaStore',
      type: 'slice',
      dependencies: [],
      dependents: ['topicsStore', 'clickhouseStore'],
      resetMethod: 'resetKafkaStore',
    },
    topicsStore: {
      id: 'topicsStore',
      type: 'slice',
      dependencies: ['kafkaStore'],
      dependents: ['joinStore', 'clickhouseStore'],
      resetMethod: 'resetTopicsStore',
    },
    joinStore: {
      id: 'joinStore',
      type: 'slice',
      dependencies: ['topicsStore'],
      dependents: ['clickhouseStore'],
      resetMethod: 'resetJoinStore',
    },
    clickhouseStore: {
      id: 'clickhouseStore',
      type: 'slice',
      dependencies: ['kafkaStore'],
      dependents: [],
      resetMethod: 'resetClickhouseStore',
    },
    // TODO: check how changes in stepsStore affect the other slices
    stepsStore: {
      id: 'stepsStore',
      type: 'slice',
      dependencies: [],
      dependents: [],
      resetMethod: 'resetStepsStore',
    },
  },
  edges: [
    // Data Flow: Who provides data to whom

    // Kafka provides connection data to other components
    { from: 'kafkaStore', to: 'topicsStore' }, // Topics need Kafka connection
    { from: 'kafkaStore', to: 'clickhouseStore' }, // ClickHouse might need Kafka config
    { from: 'kafkaStore', to: 'joinStore' }, // Join might need Kafka connection

    // Topics provide data to downstream components
    { from: 'topicsStore', to: 'joinStore' }, // Join needs topic data
    { from: 'topicsStore', to: 'clickhouseStore' }, // ClickHouse mapping needs topic data

    // Join provides configuration to ClickHouse
    { from: 'joinStore', to: 'clickhouseStore' }, // ClickHouse needs join config

    // Steps provide navigation state
    { from: 'stepsStore', to: 'kafkaStore' }, // Steps control Kafka connection flow
    { from: 'stepsStore', to: 'topicsStore' }, // Steps control topic selection flow
    { from: 'stepsStore', to: 'joinStore' }, // Steps control join configuration flow
    { from: 'stepsStore', to: 'clickhouseStore' }, // Steps control ClickHouse flow
  ],
}

export { DEPENDENCY_GRAPH }
