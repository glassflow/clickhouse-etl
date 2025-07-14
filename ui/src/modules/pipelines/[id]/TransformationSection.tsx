import SingleCard from './SingleCard'
import DoubleCard from './DoubleCard'

function TransformationSection({ pipeline }: { pipeline: any }) {
  const { source, join, sink } = pipeline

  // Extract topics from source
  const topics = source?.topics || []
  const hasJoin = join?.enabled || false
  const joinSources = join?.sources || []

  // Get destination table info
  const destinationTable = sink?.table || 'N/A'
  const tableMapping = sink?.table_mapping || []
  const totalSourceFields = tableMapping.length
  const totalDestinationColumns = tableMapping.length

  // Simple case: Single topic, no join (like first screenshot)
  if (topics.length === 1 && !hasJoin) {
    const topic = topics[0]
    const hasDedup = topic.deduplication?.enabled || false

    return (
      <div className="flex flex-col gap-4">
        {/* Top card: Topic */}
        <SingleCard label={['Topic']} value={[topic.name]} orientation="center" width="full" />

        {/* Middle card: Deduplication Key (only if dedup is enabled) */}
        {hasDedup && (
          <SingleCard
            label={['Deduplication Key']}
            value={[topic.deduplication.id_field]}
            orientation="center"
            width="full"
          />
        )}

        {/* Bottom card: Destination Table and Schema Mapping */}
        <DoubleCard
          label={['Destination Table', 'Schema Mapping']}
          value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
          width="full"
        />
      </div>
    )
  }

  // Complex case: Multiple topics with join (like second screenshot)
  if (topics.length > 1 && hasJoin) {
    const leftSource = joinSources.find((s: any) => s.orientation === 'left')
    const rightSource = joinSources.find((s: any) => s.orientation === 'right')

    const leftTopic = topics.find((t: any) => t.name === leftSource?.source_id)
    const rightTopic = topics.find((t: any) => t.name === rightSource?.source_id)

    return (
      <div className="flex flex-col gap-4">
        {/* Topics with Dedup Keys - Left and Right */}
        <DoubleCard
          label={['Left Topic', 'Right Topic']}
          value={[leftTopic?.name || 'N/A', rightTopic?.name || 'N/A']}
          width="full"
        />

        <DoubleCard
          label={['Dedup Key', 'Dedup Key']}
          value={[
            leftTopic?.deduplication?.enabled ? leftTopic.deduplication.id_field : 'None',
            rightTopic?.deduplication?.enabled ? rightTopic.deduplication.id_field : 'None',
          ]}
          width="full"
        />

        {/* Join Keys - Left and Right */}
        <DoubleCard
          label={['Left Join Key', 'Right Join Key']}
          value={[leftSource?.join_key || 'N/A', rightSource?.join_key || 'N/A']}
          width="full"
        />

        {/* Destination Table and Schema Mapping */}
        <DoubleCard
          label={['Destination Table', 'Schema Mapping']}
          value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
          width="full"
        />
      </div>
    )
  }

  // Fallback case
  return (
    <div className="flex flex-col gap-4">
      <SingleCard
        label={['Configuration']}
        value={[`${topics.length} topic(s), Join: ${hasJoin ? 'Yes' : 'No'}`]}
        orientation="center"
        width="full"
      />
      <DoubleCard
        label={['Destination Table', 'Schema Mapping']}
        value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
        width="full"
      />
    </div>
  )
}

export default TransformationSection
