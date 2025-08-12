import { Card } from '@/src/components/ui/card'
import { ValidationState } from '@/src/types/validation'
import { cn } from '@/src/utils/common.client'

interface TitleCardWithIconProps {
  title: string
  children: React.ReactNode
  onClick?: () => void
  isClickable?: boolean
  disabled?: boolean
  validation?: ValidationState
  selected?: boolean
}

function TitleCardWithIcon({
  title,
  children,
  onClick,
  isClickable = false,
  disabled = false,
  validation,
  selected = false,
}: TitleCardWithIconProps) {
  const handleClick = () => {
    if (disabled) return
    onClick?.()
  }

  return (
    <Card
      className={cn(
        'border-[var(--color-border-neutral)] radius-large p-6 h-48 flex flex-col items-center justify-center',
        isClickable &&
          'cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        validation?.status === 'invalidated' && 'border-red-500',
        selected && 'border-primary',
      )}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="flex items-center justify-center">{children}</div>
        <h3 className="text-lg font-bold text-center text-[var(--color-foreground-neutral-faded)]" text->
          {title}
        </h3>
        {isClickable && <p className="text-sm text-gray-500 text-center">Click to edit</p>}
      </div>
    </Card>
  )
}

export default TitleCardWithIcon
