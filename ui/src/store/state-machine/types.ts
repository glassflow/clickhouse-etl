// Types for the dependency system
import { OperationKeys } from '@/src/config/constants'

export type StoreSlice =
  | 'kafkaStore'
  | 'clickhouseConnectionStore'
  | 'clickhouseDestinationStore'
  | 'topicsStore'
  | 'joinStore'
  | 'stepsStore'
export type OperationType =
  | OperationKeys.DEDUPLICATION
  | OperationKeys.JOINING
  | OperationKeys.DEDUPLICATION_JOINING
  | OperationKeys.INGEST_ONLY
export type StepType =
  | 'kafka-connection'
  | 'topic-selection'
  | 'deduplication-configurator'
  | 'join-configurator'
  | 'clickhouse-connection'
  | 'clickhouse-mapper'

export interface DependencyNode {
  id: string
  type: 'operation' | 'step' | 'slice'
  dependencies: string[] // IDs of nodes this depends on
  dependents: string[] // IDs of nodes that depend on this
  resetMethod?: string // Method to call for reset
}

export interface DependencyGraph {
  nodes: Record<string, DependencyNode>
  edges: Array<{ from: string; to: string }>
}
