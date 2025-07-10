import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import OverviewCard from './OverviewCard'

function OverviewSection() {
  return (
    <Card className="py-0 px-0 mb-4 border-none">
      <div className="flex flex-row gap-4">
        <OverviewCard title="Health" value="100" type="health" />
        <OverviewCard title="Metrics" value="100" type="metrics" />
      </div>
    </Card>
  )
}

export default OverviewSection
