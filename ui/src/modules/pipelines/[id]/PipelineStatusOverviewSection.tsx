import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import DeadLetterQueueCard from './DeadLetterQueueCard'
import ClickHouseTableMetricsCard from './ClickHouseTableMetricsCard'
import PipelineHealthCard from './PipelineHealthCard'
import { Pipeline } from '@/src/types/pipeline'

function PipelineStatusOverviewSection({ pipeline }: { pipeline: Pipeline }) {
  return (
    <Card className="py-0 px-0 mb-4 border-none">
      <div className="flex flex-row gap-4 items-start">
        {/* <PipelineHealthCard status="stable" /> */}
        <DeadLetterQueueCard pipelineId={pipeline.pipeline_id} />
        <ClickHouseTableMetricsCard pipeline={pipeline} />
      </div>
    </Card>
  )
}

export default PipelineStatusOverviewSection
