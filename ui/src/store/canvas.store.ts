import {
  type Node,
  type Edge,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import { StateCreator } from 'zustand'
import { validateCanvas, type ValidationResult } from '@/src/modules/canvas/canvas-validation'

export type CanvasSourceType = 'kafka' | 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'

export type DeployState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'deploying' }
  | { status: 'error'; message: string }

export interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  sourceType: CanvasSourceType
  activeNodeId: string | null
  nodeConfigs: Record<string, Record<string, unknown>>
  deployState: DeployState
  isDirty: boolean
}

export interface CanvasActions {
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  applyNodeChanges: (changes: NodeChange[]) => void
  applyEdgeChanges: (changes: EdgeChange[]) => void
  setActiveNode: (id: string | null) => void
  setNodeConfig: (nodeId: string, config: Record<string, unknown>) => void
  setSourceType: (type: CanvasSourceType) => void
  initDefaultPipeline: (sourceType: CanvasSourceType) => void
  validate: () => ValidationResult
  setDeployState: (s: DeployState) => void
  markClean: () => void
  addNodeAt: (kind: string, position: { x: number; y: number }) => void
  removeNode: (id: string) => void
}

export interface CanvasSlice {
  canvasStore: CanvasState & CanvasActions
}

const buildDefaultPipeline = (
  sourceType: CanvasSourceType,
): { nodes: Node[]; edges: Edge[] } => {
  const isOtlp = sourceType !== 'kafka'
  const sourceNodeType = isOtlp ? 'otlpSource' : 'kafkaSource'

  const nodes: Node[] = [
    {
      id: 'source',
      type: sourceNodeType,
      position: { x: 0, y: 200 },
      data: { label: isOtlp ? 'OTLP Source' : 'Kafka Source' },
    },
    {
      id: 'dedup',
      type: 'dedup',
      position: { x: 250, y: 200 },
      data: { label: 'Deduplication', disabled: true },
    },
    {
      id: 'filter',
      type: 'filter',
      position: { x: 500, y: 200 },
      data: { label: 'Filter', disabled: true },
    },
    {
      id: 'transform',
      type: 'transform',
      position: { x: 750, y: 200 },
      data: { label: 'Transform', disabled: true },
    },
    {
      id: 'sink',
      type: 'clickhouseSink',
      position: { x: 1000, y: 200 },
      data: { label: 'ClickHouse Sink' },
    },
  ]

  const edges: Edge[] = [
    { id: 'e-source-dedup', source: 'source', target: 'dedup' },
    { id: 'e-dedup-filter', source: 'dedup', target: 'filter' },
    { id: 'e-filter-transform', source: 'filter', target: 'transform' },
    { id: 'e-transform-sink', source: 'transform', target: 'sink' },
  ]

  return { nodes, edges }
}

export const createCanvasSlice: StateCreator<CanvasSlice> = (set, _get) => ({
  canvasStore: {
    nodes: [],
    edges: [],
    sourceType: 'kafka',
    activeNodeId: null,
    nodeConfigs: {},
    deployState: { status: 'idle' },
    isDirty: false,

    setNodes: (nodes) =>
      set((state) => ({
        canvasStore: { ...state.canvasStore, nodes, isDirty: true },
      })),

    setEdges: (edges) =>
      set((state) => ({
        canvasStore: { ...state.canvasStore, edges, isDirty: true },
      })),

    applyNodeChanges: (changes) =>
      set((state) => ({
        canvasStore: {
          ...state.canvasStore,
          nodes: applyNodeChanges(changes, state.canvasStore.nodes),
          isDirty: true,
        },
      })),

    applyEdgeChanges: (changes) =>
      set((state) => ({
        canvasStore: {
          ...state.canvasStore,
          edges: applyEdgeChanges(changes, state.canvasStore.edges),
          isDirty: true,
        },
      })),

    setActiveNode: (id) =>
      set((state) => ({
        canvasStore: { ...state.canvasStore, activeNodeId: id },
      })),

    setNodeConfig: (nodeId, config) =>
      set((state) => ({
        canvasStore: {
          ...state.canvasStore,
          nodeConfigs: {
            ...state.canvasStore.nodeConfigs,
            [nodeId]: config,
          },
          isDirty: true,
        },
      })),

    setSourceType: (type) =>
      set((state) => ({
        canvasStore: { ...state.canvasStore, sourceType: type },
      })),

    initDefaultPipeline: (sourceType) => {
      const { nodes, edges } = buildDefaultPipeline(sourceType)
      set((state) => ({
        canvasStore: {
          ...state.canvasStore,
          nodes,
          edges,
          sourceType,
          activeNodeId: null,
          nodeConfigs: {},
          isDirty: false,
        },
      }))
    },

    validate: () => {
      const s = (_get() as { canvasStore: CanvasState }).canvasStore
      return validateCanvas(s.nodes, s.edges, s.nodeConfigs)
    },

    setDeployState: (deployState) =>
      set((state) => ({
        canvasStore: { ...state.canvasStore, deployState },
      })),

    markClean: () =>
      set((state) => ({
        canvasStore: { ...state.canvasStore, isDirty: false },
      })),

    addNodeAt: (kind, position) =>
      set((state) => {
        const id = `${kind}-${Date.now()}`
        const newNode: Node = { id, type: kind, position, data: { label: kind } }
        return {
          canvasStore: {
            ...state.canvasStore,
            nodes: [...state.canvasStore.nodes, newNode],
            isDirty: true,
          },
        }
      }),

    removeNode: (id) =>
      set((state) => ({
        canvasStore: {
          ...state.canvasStore,
          nodes: state.canvasStore.nodes.filter((n: Node) => n.id !== id),
          edges: state.canvasStore.edges.filter(
            (e: Edge) => e.source !== id && e.target !== id,
          ),
          activeNodeId:
            state.canvasStore.activeNodeId === id ? null : state.canvasStore.activeNodeId,
          isDirty: true,
        },
      })),
  },
})
