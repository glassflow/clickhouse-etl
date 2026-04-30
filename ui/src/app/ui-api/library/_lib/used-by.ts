/**
 * Phase 1 fallback: returns pipelines whose live config references the given
 * resource. Phase 3 will replace this with a query against `pipeline_references`.
 *
 * Today's pipeline configs do not yet carry library resource refs (those land in
 * Phase 3 once `pipeline_references` exists). Until then this helper performs a
 * best-effort scan and gracefully returns an empty array when the inputs are
 * not yet present in the legacy backend response.
 */

import { getPipelines, getPipeline } from '@/src/api/pipeline-api'
import type { ListPipelineConfig, Pipeline } from '@/src/types/pipeline'

export type UsedByEntry = {
  pipelineId: string
  pipelineName: string
  pinnedVersion?: string
}

async function loadFullPipelines(): Promise<Pipeline[]> {
  let list: ListPipelineConfig[] = []
  try {
    list = await getPipelines()
  } catch {
    return []
  }
  const fulls = await Promise.all(
    list.map(async (p) => {
      try {
        return (await getPipeline(p.pipeline_id)) as Pipeline
      } catch {
        return null
      }
    }),
  )
  return fulls.filter((p): p is Pipeline => p !== null)
}

export async function findPipelinesUsingKafkaConnection(
  connectionId: string,
): Promise<UsedByEntry[]> {
  const pipelines = await loadFullPipelines()
  return pipelines
    .filter((p) => readKafkaConnectionId(p) === connectionId)
    .map((p) => ({ pipelineId: p.pipeline_id, pipelineName: p.name ?? p.pipeline_id }))
}

export async function findPipelinesUsingClickhouseConnection(
  connectionId: string,
): Promise<UsedByEntry[]> {
  const pipelines = await loadFullPipelines()
  return pipelines
    .filter((p) => readClickhouseConnectionId(p) === connectionId)
    .map((p) => ({ pipelineId: p.pipeline_id, pipelineName: p.name ?? p.pipeline_id }))
}

export async function findPipelinesUsingSchema(schemaId: string): Promise<UsedByEntry[]> {
  const pipelines = await loadFullPipelines()
  return pipelines
    .filter((p) => readSchemaIds(p).includes(schemaId))
    .map((p) => ({
      pipelineId: p.pipeline_id,
      pipelineName: p.name ?? p.pipeline_id,
      pinnedVersion: readSchemaPinnedVersion(p, schemaId),
    }))
}

// --- Adapters: read library refs out of pipeline config without coupling ---

function readKafkaConnectionId(p: Pipeline): string | undefined {
  // Phase 1: pipeline configs do not yet carry library refs. The optional
  // `connectionRef.id` is the shape Phase 3 will introduce on `source` /
  // `sink`. Until then this safely returns undefined.
  const source = p.source as unknown as { connectionRef?: { id?: string } } | undefined
  return source?.connectionRef?.id
}

function readClickhouseConnectionId(p: Pipeline): string | undefined {
  const sink = p.sink as unknown as { connectionRef?: { id?: string } } | undefined
  return sink?.connectionRef?.id
}

function readSchemaIds(p: Pipeline): string[] {
  const refs: string[] = []
  const topics =
    (p.source as unknown as { topics?: Array<{ schemaRef?: { id?: string } }> })?.topics ?? []
  for (const t of topics) {
    if (t?.schemaRef?.id) refs.push(t.schemaRef.id)
  }
  return refs
}

function readSchemaPinnedVersion(p: Pipeline, schemaId: string): string | undefined {
  const topics =
    (p.source as unknown as {
      topics?: Array<{ schemaRef?: { id?: string; pinnedVersion?: string } }>
    })?.topics ?? []
  const t = topics.find((x) => x?.schemaRef?.id === schemaId)
  return t?.schemaRef?.pinnedVersion
}
