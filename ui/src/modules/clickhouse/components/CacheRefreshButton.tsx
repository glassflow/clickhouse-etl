import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { cn } from '@/src/utils/common.client'

interface CacheRefreshButtonProps {
  type: 'databases' | 'tables' | 'tableSchema' | 'topics'
  database?: string
  table?: string
  onRefresh: () => Promise<void>
  className?: string
  size?: 'sm' | 'lg' | 'default'
  variant?: 'outline' | 'ghost' | 'default'
  disabled?: boolean
}

export function CacheRefreshButton({
  type,
  database,
  table,
  onRefresh,
  className,
  size = 'sm',
  variant = 'outline',
  disabled,
}: CacheRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isRefreshing || disabled}
      className={cn(
        'transition-all duration-200',
        {
          'animate-spin': isRefreshing,
          'opacity-50 cursor-not-allowed': disabled && !isRefreshing,
          'text-muted-foreground': disabled && !isRefreshing,
        },
        className,
        'btn-neutral',
      )}
      title={`Refresh ${type} data`}
    >
      <ArrowPathIcon
        className={cn('h-4 w-4', {
          'text-muted-foreground opacity-50': disabled && !isRefreshing,
        })}
      />
      <span
        className={cn({
          'text-muted-foreground opacity-50': disabled && !isRefreshing,
        })}
      >
        Reload
      </span>
    </Button>
  )
}
