'use client'

import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeChange,
  type EdgeChange,
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
import { LibrarySidebar } from './LibrarySidebar'

export function CanvasView() {
  const { canvasStore } = useStore()
  const {
    nodes,
    edges,
    activeNodeId,
    setActiveNode,
    applyNodeChanges,
    applyEdgeChanges,
    initDefaultPipeline,
  } = canvasStore

  useEffect(() => {
    if (nodes.length === 0) {
      initDefaultPipeline('kafka')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nodeTypes = useMemo(
    () => ({
      kafkaSource: KafkaSourceNode,
      otlpSource: OtlpSourceNode,
      dedup: DedupNode,
      filter: FilterNode,
      transform: TransformNode,
      join: JoinNode,
      clickhouseSink: ClickHouseSinkNode,
    }),
    [],
  )

  const handleNodesChange = (changes: NodeChange[]) => {
    applyNodeChanges(changes)
  }

  const handleEdgesChange = (changes: EdgeChange[]) => {
    applyEdgeChanges(changes)
  }

  return (
    <div className="flex h-full gap-4">
      <LibrarySidebar />
      <div className="flex-1 relative rounded-lg overflow-hidden border border-[var(--surface-border)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeClick={(_, node) => setActiveNode(node.id)}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      {activeNodeId && <NodeConfigPanel nodeId={activeNodeId} onClose={() => setActiveNode(null)} />}
    </div>
  )
}
