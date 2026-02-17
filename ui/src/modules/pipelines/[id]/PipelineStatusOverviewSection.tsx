import { Card } from '@/src/components/ui/card'
import DeadLetterQueueCard from './DeadLetterQueueCard'
import ClickHouseTableMetricsCard from './ClickHouseTableMetricsCard'
import { Pipeline } from '@/src/types/pipeline'
import { cn } from '@/src/utils/common.client'

function PipelineStatusOverviewSection({
  pipeline,
  showStatusOverview,
  refreshDLQTrigger,
}: {
  pipeline: Pipeline
  showStatusOverview: boolean
  refreshDLQTrigger?: number
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 transition-all duration-750 ease-out',
        showStatusOverview ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
    >
      {/* <Card className="py-0 px-0 mb-4 border-none"> */}
      <div className="flex flex-row gap-4 items-start">
        {/* <PipelineHealthCard status="stable" /> */}
        <DeadLetterQueueCard pipelineId={pipeline.pipeline_id} refreshTrigger={refreshDLQTrigger} />
        <ClickHouseTableMetricsCard pipeline={pipeline} />
      </div>
      {/* </Card> */}
    </div>
  )
}

export default PipelineStatusOverviewSection
