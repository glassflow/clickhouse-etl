import { Card } from '@/src/components/ui/card'
import { cn } from '@/src/utils/common.client'

function SingleColumnCard({
  label,
  value,
  orientation = 'center',
  width = 'half',
  onClick,
  disabled,
  validation,
  selected,
}: {
  label: string[]
  value: string[]
  orientation?: 'left' | 'right' | 'center'
  width?: 'full' | 'half'
  onClick?: () => void
  disabled?: boolean
  validation?: any
  selected?: boolean
}) {
  const widthClass = width === 'full' ? 'w-full' : 'w-1/2'
  const alignmentClass = orientation === 'left' ? 'items-start' : orientation === 'right' ? 'items-end' : 'items-center'
  const textAlignClass = orientation === 'left' ? 'text-left' : orientation === 'right' ? 'text-right' : 'text-center'

  return (
    <Card
      className={cn(
        'card-outline p-4',
        widthClass,
        disabled && 'opacity-50 cursor-not-allowed',
        validation?.status === 'invalidated' && 'card-outline-error',
        selected && 'card-outline-selected',
      )}
      onClick={onClick}
    >
      <div className={`flex flex-col gap-4 ${alignmentClass}`}>
        <div className={`flex flex-col gap-2 ${textAlignClass}`}>
          <span className="text-lg font-bold text-[var(--color-foreground-neutral-faded)]">{label[0]}</span>
          <span className="text-sm font-normal">{value[0]}</span>
          {label[1] && (
            <span className="text-lg font-bold text-[var(--color-foreground-neutral-faded)]">{label[1]}</span>
          )}
          {value[1] && <span className="text-sm font-normal">{value[1]}</span>}
        </div>
      </div>
    </Card>
  )
}

export default SingleColumnCard
