import { cn } from '@/src/utils/common.client'

type SkeletonProps = {
  width?: number | string
  height?: number | string
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export function Skeleton({ width, height, className, rounded = 'md' }: SkeletonProps) {
  const radiusClass = {
    sm: 'rounded-[4px]',
    md: 'rounded-[6px]',
    lg: 'rounded-[10px]',
    full: 'rounded-full',
  }[rounded]

  return (
    <div
      data-skeleton
      className={cn(
        'animate-skeletonShimmer bg-[length:200%_100%]',
        'bg-gradient-to-r from-[var(--color-background-elevation-raised-faded)] via-[var(--color-background-elevation-raised)] to-[var(--color-background-elevation-raised-faded)]',
        radiusClass,
        className,
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  )
}

type SkeletonRowProps = {
  count?: number
  rowHeight?: number
  className?: string
}

export function SkeletonRow({ count = 3, rowHeight = 44, className }: SkeletonRowProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={rowHeight} className="w-full" />
      ))}
    </div>
  )
}
