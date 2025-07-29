import { Card } from '@/src/components/ui/card'

function DoubleColumnCard({
  label,
  value,
  width = 'half',
  onClick,
  disabled,
}: {
  label: string[]
  value: string[]
  width?: 'full' | 'half'
  onClick?: () => void
  disabled?: boolean
}) {
  const widthClass = width === 'full' ? 'w-full' : 'w-1/2'

  return (
    <Card
      className={`border-[var(--color-border-neutral)] rounded-md p-4 ${widthClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
