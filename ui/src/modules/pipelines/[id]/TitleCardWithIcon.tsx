import { Card } from '@/src/components/ui/card'
import { ValidationState } from '@/src/types/validation'
import { cn } from '@/src/utils/common.client'

interface TitleCardWithIconProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClick?: () => void
  isClickable?: boolean
  disabled?: boolean
  validation?: ValidationState
  selected?: boolean
}

function TitleCardWithIcon({
  title,
  subtitle,
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
        'card-outline p-5 items-center justify-center',
        (onClick && !disabled) && 'cursor-pointer',
        isClickable && 'hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        validation?.status === 'invalidated' && 'card-outline-error',
        selected && 'card-outline-selected',
      )}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="flex items-center justify-center">{children}</div>
        <h3 className="body-2 font-bold text-center text-[var(--color-foreground-neutral-faded)]">{title}</h3>
        {subtitle && (
          <p className="caption-1 text-center text-muted-foreground truncate w-full max-w-[140px]" title={subtitle}>
            {subtitle}
          </p>
        )}
        {isClickable && <p className="caption-1 text-[var(--color-foreground-neutral-faded)] text-center">Click to edit</p>}
      </div>
    </Card>
  )
}

export default TitleCardWithIcon
