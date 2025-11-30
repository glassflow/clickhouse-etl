import { PipelineAdapter } from './types'
import { InternalPipelineConfig, Pipeline } from '@/src/types/pipeline'
import { PipelineVersion } from '@/src/config/pipeline-versions'

export class V2PipelineAdapter implements PipelineAdapter {
  version = PipelineVersion.V2

  hydrate(apiConfig: any): InternalPipelineConfig {
    // Convert V2 API config (with root-level schema) to Internal (V1-like) structure

    // 1. Deep clone to avoid mutating original
    const internalConfig = JSON.parse(JSON.stringify(apiConfig)) as any

    // 2. Handle Schema hydration (Api V2 -> Internal V1)
    // V2: schema.fields[] contains mapping info + source topic info + types
    // Internal/V1:
    //   - source.topics[].schema (json schema)
    //   - sink.table_mapping (clickhouse mapping)

    const v2Fields = apiConfig.schema?.fields || []

    // Reconstruct sink.table_mapping
    // In V2: schema.fields elements have: source_id, name, type, column_name, column_type
    // In Internal/V1: sink.table_mapping elements have: source_id, field_name, column_name, column_type
    if (v2Fields.length > 0) {
      if (!internalConfig.sink) internalConfig.sink = {}

      internalConfig.sink.table_mapping = v2Fields.map((field: any) => ({
        source_id: field.source_id,
        field_name: field.name,
        column_name: field.column_name,
        column_type: field.column_type,
      }))
    }

    // Reconstruct source.topics[].schema
    // In V2: root schema.fields combines everything.
    // In Internal/V1: Each topic has a schema definition.
    // We need to group V2 fields by source_id (which maps to topic name) to rebuild topic schemas

    const fieldsByTopic: Record<string, any[]> = {}
    v2Fields.forEach((field: any) => {
      const topicId = field.source_id
      if (!fieldsByTopic[topicId]) {
        fieldsByTopic[topicId] = []
      }
      fieldsByTopic[topicId].push(field)
    })

    if (internalConfig.source && Array.isArray(internalConfig.source.topics)) {
      internalConfig.source.topics.forEach((topic: any) => {
        const topicFields = fieldsByTopic[topic.name] || []

        // Rebuild the V1 schema object for this topic
        topic.schema = {
          type: 'json',
          fields: topicFields.map((f: any) => ({
            name: f.name,
            type: f.type,
          })),
        }
      })
    }

    // 3. Handle Sink properties
    // In V2, max_batch_size, max_delay_time, skip_certificate_verification are in sink (same as V1 actually?)
    // Checking "old.json" (V1) vs "new.json" (V2):
    // Old: sink has max_batch_size, max_delay_time, skip_certificate_verification
    // New: sink also has them.
    // Wait, the prompt said: "max_batch_size, max_delay_time and skip_certificate_verification need to be moved out to the sink."
    // Looking at new.json, they ARE in the sink.
    // Looking at old.json, they ARE in the sink.
    // The prompt might mean "moved out FROM somewhere TO sink" or "moved out OF sink".
    // Let's re-read the prompt carefully:
    // "Also, max_batch_size, max_delay_time and skip_certificate_verification need to be moved out to the sink."
    // This usually implies they were somewhere else and now go to sink, OR they stay in sink.
    // However, comparison shows they are in sink in BOTH.
    // Wait, let's look at `table_mapping`.
    // Old: sink.table_mapping exists.
    // New: sink.table_mapping is GONE. Replaced by root "schema".

    // So for hydration:
    // We already moved schema fields -> sink.table_mapping (Internal expects this)
    // We already moved schema fields -> topic.schema (Internal expects this)

    // Internal config expects version to be set?
    internalConfig.version = this.version

    // Clean up V2 specific fields that Internal doesn't use (optional, but cleaner)
    delete internalConfig.schema

    return internalConfig as InternalPipelineConfig
  }

  generate(internalConfig: InternalPipelineConfig): any {
    // Convert Internal UI config (V1-like) to V2 API config

    // 1. Deep clone
    const apiConfig = JSON.parse(JSON.stringify(internalConfig)) as any

    // 2. Extract mappings and schemas to build root "schema"
    // Internal: sink.table_mapping + source.topics[].schema
    // V2: root schema.fields

    const v2Fields: any[] = []

    const tableMapping = internalConfig.sink?.table_mapping || []
    const topics = internalConfig.source?.topics || []

    // We iterate through table mappings to build the V2 fields
    // We need to merge info from table_mapping (destination info) and topic schema (source info)

    tableMapping.forEach((mapping: any) => {
      // Find source type from topic schema
      const topic = topics.find((t: any) => t.name === mapping.source_id)
      const topicField = topic?.schema?.fields?.find((f: any) => f.name === mapping.field_name)

      v2Fields.push({
        source_id: mapping.source_id,
        name: mapping.field_name,
        type: topicField?.type || 'string', // Default or fallback
        column_name: mapping.column_name,
        column_type: mapping.column_type,
      })
    })

    // 3. Construct V2 Root Schema
    apiConfig.schema = {
      fields: v2Fields,
    }

    // 4. Remove Internal/V1 fields that don't exist in V2
    if (apiConfig.sink) {
      delete apiConfig.sink.table_mapping
    }

    if (apiConfig.source && Array.isArray(apiConfig.source.topics)) {
      apiConfig.source.topics.forEach((topic: any) => {
        delete topic.schema
      })
    }

    // 5. Set version
    apiConfig.version = this.version

    return apiConfig
  }
}
