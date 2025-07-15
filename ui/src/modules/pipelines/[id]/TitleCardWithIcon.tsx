import { Card } from '@/src/components/ui/card'
import { cn } from '@/src/utils'

interface TitleCardWithIconProps {
  title: string
  children: React.ReactNode
  onClick?: () => void
  isClickable?: boolean
}

function TitleCardWithIcon({ title, children, onClick, isClickable = false }: TitleCardWithIconProps) {
  return (
    <Card
      className={cn(
        'border-[var(--color-border-neutral)] rounded-md p-6 h-48 flex flex-col items-center justify-center',
        isClickable &&
          'cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:scale-[1.02]',
      )}
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="flex items-center justify-center">{children}</div>
        <h3 className="text-lg font-bold text-center">{title}</h3>
        {isClickable && <p className="text-sm text-gray-500 text-center">Click to edit</p>}
      </div>
    </Card>
  )
}

export default TitleCardWithIcon
