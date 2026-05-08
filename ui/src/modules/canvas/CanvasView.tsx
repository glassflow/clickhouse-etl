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
import { notify } from '@/src/notifications/notify'
import { isValidNodeConnection } from './canvas-validation'
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
import { UnsavedChangesGuard } from './UnsavedChangesGuard'
import { serializeCanvas, extractLibraryReferences, pipelineConfigToCanvas } from './serializer'
import type { InternalPipelineConfig } from '@/src/types/pipeline'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/src/components/ui/drawer'

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
  initialConfig?: InternalPipelineConfig | null
}

function CanvasInner({ pipelineId, currentRevision, initialConfig }: CanvasViewProps) {
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
    initFromConfig,
  } = canvasStore

  const reactFlow = useReactFlow()
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (initialConfig) {
      initFromConfig(pipelineConfigToCanvas(initialConfig))
    } else if (nodes.length === 0) {
      initDefaultPipeline('kafka')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Below 1280px viewports, the right-side config panel collides with the
  // node palette + canvas viewport. Switch to a Drawer overlay instead so
  // the user still has full canvas width while editing a node.
  const [viewportTooNarrow, setViewportTooNarrow] = React.useState(false)
  React.useEffect(() => {
    const fn = () => setViewportTooNarrow(window.innerWidth < 1280)
    fn()
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
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
    const source = nodes.find((n) => n.id === conn.source)
    const target = nodes.find((n) => n.id === conn.target)
    if (!isValidNodeConnection(source, target)) {
      notify({
        variant: 'warning',
        title: 'Invalid connection',
        description: `Can't connect ${source?.type ?? 'unknown'} → ${target?.type ?? 'unknown'}.`,
      })
      return
    }
    setEdges(addEdge(conn, edges))
  }

  const isValidConnection = (conn: Connection | { source: string; target: string }) => {
    const source = nodes.find((n) => n.id === conn.source)
    const target = nodes.find((n) => n.id === conn.target)
    return isValidNodeConnection(source, target)
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

    const references = extractLibraryReferences(canvasStore.nodeConfigs)

    const url = pipelineId
      ? `/ui-api/pipelines/${pipelineId}/revisions`
      : '/ui-api/pipelines'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ env, config, references }),
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
      <UnsavedChangesGuard />
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
            isValidConnection={isValidConnection}
            onNodeClick={(_, node) => setActiveNode(node.id)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        {activeNodeId && !viewportTooNarrow && (
          <NodeConfigPanel nodeId={activeNodeId} onClose={() => setActiveNode(null)} />
        )}
      </div>
      {activeNodeId && viewportTooNarrow && (
        <Drawer open onOpenChange={(o) => !o && setActiveNode(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Node configuration</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>
              <NodeConfigPanel
                nodeId={activeNodeId}
                onClose={() => setActiveNode(null)}
              />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}
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
