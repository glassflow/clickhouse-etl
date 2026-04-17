import { Loader2 } from 'lucide-react'
import { cn } from '@/src/utils/common.client'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

const LoadingSpinner = ({ size = 'md', className }: LoadingSpinnerProps) => {
  return (
    <Loader2
      className={cn('animate-spin text-[var(--color-foreground-primary)] shrink-0', sizeClasses[size], className)}
      aria-label="Loading"
      role="status"
    />
  )
}

export default LoadingSpinner
