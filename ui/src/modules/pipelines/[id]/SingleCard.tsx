import { Card } from '@/src/components/ui/card'

function SingleCard({
  label,
  value,
  orientation = 'center',
  width = 'half',
}: {
  label: string[]
  value: string[]
  orientation?: 'left' | 'right' | 'center'
  width?: 'full' | 'half'
}) {
  const widthClass = width === 'full' ? 'w-full' : 'w-1/2'
  const alignmentClass = orientation === 'left' ? 'items-start' : orientation === 'right' ? 'items-end' : 'items-center'
  const textAlignClass = orientation === 'left' ? 'text-left' : orientation === 'right' ? 'text-right' : 'text-center'

  return (
    <Card className={`border-[var(--color-border-neutral)] rounded-md p-4 ${widthClass}`}>
      <div className={`flex flex-col gap-4 ${alignmentClass}`}>
        <div className={`flex flex-col gap-2 ${textAlignClass}`}>
          <span className="text-lg font-bold">{label[0]}</span>
          <span className="text-sm font-normal">{value[0]}</span>
          {label[1] && <span className="text-lg font-bold">{label[1]}</span>}
          {value[1] && <span className="text-sm font-normal">{value[1]}</span>}
        </div>
      </div>
    </Card>
  )
}

export default SingleCard
