import { Skeleton } from '@/src/components/ui/skeleton'

export function LibraryCardSkeleton() {
  return (
    <div className="card-dark flex flex-col gap-3 p-4 rounded-xl">
      {/* Header row */}
      <div className="flex items-center gap-2.5">
        <Skeleton width={28} height={28} rounded="md" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Skeleton width="55%" height={14} />
          <Skeleton width="40%" height={11} />
        </div>
        <Skeleton width={24} height={24} rounded="full" />
      </div>

      {/* Folder path */}
      <Skeleton width="45%" height={11} />

      {/* Tags row */}
      <div className="flex gap-1.5">
        <Skeleton width={52} height={20} rounded="full" />
        <Skeleton width={68} height={20} rounded="full" />
      </div>

      {/* Stats divider + row */}
      <div className="pt-2 border-t border-[var(--surface-border)] flex gap-4">
        <Skeleton width={60} height={11} />
        <Skeleton width={72} height={11} />
      </div>
    </div>
  )
}

export function LibraryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid="library-grid-skeleton"
    >
      {Array.from({ length: count }).map((_, i) => (
        <LibraryCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** @deprecated — use LibraryGridSkeleton */
export function LibraryListSkeleton({ rows = 5 }: { rows?: number }) {
  return <LibraryGridSkeleton count={rows} />
}
