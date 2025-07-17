import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import DeadLetterQueueCard from './DeadLetterQueueCard'
import PipelineHealthCard from './PipelineHealthCard'

function PipelineStatusOverviewSection() {
  return (
    <Card className="py-0 px-0 mb-4 border-none">
      <div className="flex flex-row gap-4">
        <PipelineHealthCard status="stable" />
        <DeadLetterQueueCard value="100" type="metrics" />
      </div>
    </Card>
  )
}

export default PipelineStatusOverviewSection
