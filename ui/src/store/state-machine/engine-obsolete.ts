import { DependencyGraph, OperationType, StepType } from './types'
import { OperationKeys } from '@/src/config/constants'

class ResetEngine {
  private graph: DependencyGraph
  private store: any

  constructor(graph: DependencyGraph, store: any) {
    this.graph = graph
    this.store = store
  }

  // Find all nodes that need to be reset when a specific node changes
  private findAffectedNodes(nodeId: string): string[] {
    const affected = new Set<string>()
    const queue = [nodeId]

    while (queue.length > 0) {
      const current = queue.shift()!
      affected.add(current)

      // Add all dependents to the queue
      const node = this.graph.nodes[current]
      if (node) {
        node.dependents.forEach((dependentId) => {
          if (!affected.has(dependentId)) {
            queue.push(dependentId)
          }
        })
      }
    }

    return Array.from(affected)
  }

  // Reset based on operation change
  resetByOperation(operation: OperationType, force: boolean = false): void {
    const affectedNodes = this.findAffectedNodes(operation)

    // Reset store slices in dependency order
    const slicesToReset = affectedNodes
      .filter((nodeId) => this.graph.nodes[nodeId].type === 'slice')
      .sort((a, b) => this.getDependencyDepth(b) - this.getDependencyDepth(a)) // Reset deepest first

    slicesToReset.forEach((sliceId) => {
      const node = this.graph.nodes[sliceId]
      if (node.resetMethod && this.store[node.id]?.[node.resetMethod]) {
        this.store[node.id][node.resetMethod]()
      }
    })

    // Reset base store properties
    this.resetBaseStoreProperties(operation)
  }

  // Reset based on step change
  resetByStep(step: StepType): void {
    const affectedNodes = this.findAffectedNodes(step)

    // Reset specific step-related state
    affectedNodes.forEach((nodeId) => {
      const node = this.graph.nodes[nodeId]
      if (node.resetMethod && this.store[node.id]?.[node.resetMethod]) {
        this.store[node.id][node.resetMethod]()
      }
    })
  }

  // Reset base store properties
  private resetBaseStoreProperties(operation: OperationType): void {
    this.store.setOperationsSelected({ operation })
    this.store.setOutboundEventPreview({ events: [] })
    this.store.markAsClean()

    // Reset steps to appropriate state based on operation
    const initialStep = this.getInitialStepForOperation(operation)
    this.store.stepsStore.setActiveStep(initialStep)
    this.store.stepsStore.setCompletedSteps([initialStep])
  }

  private getDependencyDepth(nodeId: string): number {
    const node = this.graph.nodes[nodeId]
    if (!node || node.dependencies.length === 0) return 0

    return Math.max(...node.dependencies.map((dep) => this.getDependencyDepth(dep))) + 1
  }

  private getInitialStepForOperation(operation: OperationType): string {
    switch (operation) {
      case OperationKeys.DEDUPLICATION:
      case OperationKeys.JOINING:
      case OperationKeys.DEDUPLICATION_JOINING:
      case OperationKeys.INGEST_ONLY:
        return 'kafka-connection'
      default:
        return 'kafka-connection'
    }
  }
}
