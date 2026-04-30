'use client'

import * as React from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
  addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useStore } from '@/src/store'
import { KafkaSourceNode } from './nodes/KafkaSourceNode'
import { OtlpSourceNode } from './nodes/OtlpSourceNode'
import { DedupNode } from './nodes/DedupNode'
import { FilterNode } from './nodes/FilterNode'
import { TransformNode } from './nodes/TransformNode'
import { JoinNode } from './nodes/JoinNode'
import { ClickHouseSinkNode } from './nodes/ClickHouseSinkNode'
import { NodeConfigPanel } from './NodeConfigPanel'
import { NodePalette } from './NodePalette'
import { DeployBar } from './DeployBar'
import { DriftBanner } from './DriftBanner'
import { serializeCanvas } from './serializer'

const nodeTypes = {
  kafkaSource: KafkaSourceNode,
  otlpSource: OtlpSourceNode,
  dedup: DedupNode,
  filter: FilterNode,
  transform: TransformNode,
  join: JoinNode,
  clickhouseSink: ClickHouseSinkNode,
}

type CanvasViewProps = {
  pipelineId?: string | null
  currentRevision?: number | null
}

function CanvasInner({ pipelineId, currentRevision }: CanvasViewProps) {
  const { canvasStore } = useStore()
  const {
    nodes,
    edges,
    activeNodeId,
    setActiveNode,
    applyNodeChanges,
    applyEdgeChanges,
    setEdges,
    addNodeAt,
    initDefaultPipeline,
  } = canvasStore

  const reactFlow = useReactFlow()
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (nodes.length === 0) initDefaultPipeline('kafka')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData('application/glassflow-node-kind')
    if (!kind) return

    const bounds = wrapperRef.current?.getBoundingClientRect()
    if (!bounds) return

    const position = reactFlow.screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })

    addNodeAt(kind, position)
  }

  const handleConnect = (conn: Connection) => {
    setEdges(addEdge(conn, edges))
  }

  const handleJumpToNode = (id: string) => {
    setActiveNode(id)
    const node = nodes.find((n) => n.id === id)
    if (node) {
      reactFlow.setCenter(node.position.x, node.position.y, { duration: 250, zoom: 1 })
    }
  }

  const serializeAndDeploy = async (
    env: string,
  ): Promise<{ pipelineId: string; revision: number }> => {
    const config = serializeCanvas({
      nodes,
      edges,
      configs: canvasStore.nodeConfigs,
      sourceType: canvasStore.sourceType,
    })
    const url = pipelineId
      ? `/ui-api/pipelines/${pipelineId}/revisions`
      : '/ui-api/pipelines'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ env, config }),
    })
    if (!res.ok) throw new Error(`Deploy failed (${res.status})`)
    const json = (await res.json()) as {
      pipelineId?: string
      pipeline_id?: string
      revision?: number
    }
    return {
      pipelineId: json.pipelineId ?? json.pipeline_id ?? '',
      revision: json.revision ?? 1,
    }
  }

  return (
    <div className="flex flex-col h-full">
      {pipelineId && (
        <div className="px-3 pt-3">
          <DriftBanner pipelineId={pipelineId} />
        </div>
      )}
      <div className="flex flex-1 min-h-0 gap-3 p-3">
        <NodePalette />
        <div
          ref={wrapperRef}
          className="flex-1 relative rounded-lg overflow-hidden border border-[var(--surface-border)]"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(c: NodeChange[]) => applyNodeChanges(c)}
            onEdgesChange={(c: EdgeChange[]) => applyEdgeChanges(c)}
            onConnect={handleConnect}
            onNodeClick={(_, node) => setActiveNode(node.id)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        {activeNodeId && (
          <NodeConfigPanel nodeId={activeNodeId} onClose={() => setActiveNode(null)} />
        )}
      </div>
      <DeployBar
        pipelineId={pipelineId ?? null}
        currentRevision={currentRevision ?? null}
        onJumpToNode={handleJumpToNode}
        serializeAndDeploy={serializeAndDeploy}
      />
    </div>
  )
}

export function CanvasView(props: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
