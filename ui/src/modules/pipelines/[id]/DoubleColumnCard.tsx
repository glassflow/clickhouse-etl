import { Card } from '@/src/components/ui/card'
import { cn } from '@/src/utils/common.client'

function DoubleColumnCard({
  label,
  value,
  width = 'half',
  onClick,
  disabled,
  validation,
}: {
  label: string[]
  value: string[]
  width?: 'full' | 'half'
  onClick?: () => void
  disabled?: boolean
  validation?: any
}) {
  const widthClass = width === 'full' ? 'w-full' : 'w-1/2'

  return (
    <Card
      className={cn(
        'border-[var(--color-border-neutral)] rounded-md p-4',
        widthClass,
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        validation?.topicsValidation?.status === 'invalidated' || validation?.joinValidation?.status === 'invalidated'
          ? 'border-red-500'
          : '',
      )}
      onClick={onClick}
    >
      <div className="flex flex-row justify-between gap-4">
        <div className="flex flex-col gap-2 text-left">
          <span className="text-lg font-bold">{label[0]}</span>
          <span className="text-sm font-normal">{value[0]}</span>
        </div>
        <div className="flex flex-col gap-2 text-right">
          <span className="text-lg font-bold">{label[1]}</span>
          <span className="text-sm font-normal">{value[1]}</span>
        </div>
      </div>
    </Card>
  )
}

export default DoubleColumnCard
