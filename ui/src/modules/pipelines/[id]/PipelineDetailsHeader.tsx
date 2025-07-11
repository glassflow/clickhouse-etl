import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Card } from '@/src/components/ui/card'
import { StatusBadge } from '@/src/components/common/StatusBadge'
import { StatusType } from '@/src/config/constants'
import ActionButton from '@/src/components/shared/ActionButton'

function PipelineDetailsHeader({
  title,
  status,
  actions,
}: {
  title: string
  status: StatusType
  actions?: React.ReactNode
}) {
  return (
    <Card className="border-[var(--color-border-neutral)] rounded-md py-2 px-6 mb-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row justify-between gap-2">
          <div className="flex flex-row flex-start gap-2">
            <h2 className="text-2xl font-bold">{title}</h2>
            <StatusBadge status={status} />
          </div>
          <div className="flex flex-row flex-end gap-2">
            {actions || (
              <>
                <ActionButton action="rename" />
                <ActionButton action="delete" />
                <ActionButton action="pause" />
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default PipelineDetailsHeader
