import { Skeleton } from '@/src/components/ui/skeleton'

type LibraryListSkeletonProps = {
  rows?: number
}

export function LibraryListSkeleton({ rows = 5 }: LibraryListSkeletonProps) {
  return (
    <div
      className="flex flex-col divide-y divide-[var(--surface-border)] rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)]"
      data-testid="library-list-skeleton"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_80px_80px_40px] items-center gap-3 px-4 py-3"
        >
          <Skeleton width="60%" height={14} />
          <Skeleton width={56} height={20} rounded="full" />
          <Skeleton width="80%" height={12} />
          <Skeleton width={24} height={24} rounded="full" />
        </div>
      ))}
    </div>
  )
}
