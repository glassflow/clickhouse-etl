import { Skeleton } from '@/src/components/ui/skeleton'

function LibraryRowSkeleton() {
  return (
    <div className="flex items-center gap-5 px-4 py-3 border-b border-[var(--color-gray-dark-800)] last:border-b-0 bg-[var(--table-row-bg)]">
      <Skeleton width={22} height={22} rounded="sm" className="shrink-0" />
      <Skeleton width="22%" height={13} />
      <Skeleton width="10%" height={11} />
      <Skeleton width="16%" height={11} />
      <Skeleton width="14%" height={11} />
      <Skeleton width="8%" height={11} className="ml-auto" />
    </div>
  )
}

export function LibraryTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--color-gray-dark-800)]"
      data-testid="library-table-skeleton"
    >
      {/* Header */}
      <div className="flex items-center gap-8 px-4 py-2.5 bg-[var(--table-header-bg)] border-b border-[var(--color-gray-dark-800)]">
        <Skeleton width={40} height={10} />
        <Skeleton width={50} height={10} />
        <Skeleton width={55} height={10} />
        <Skeleton width={45} height={10} />
        <Skeleton width={50} height={10} className="ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <LibraryRowSkeleton key={i} />
      ))}
    </div>
  )
}

/** @deprecated — use LibraryTableSkeleton */
export function LibraryGridSkeleton({ count = 5 }: { count?: number }) {
  return <LibraryTableSkeleton rows={count} />
}

/** @deprecated — use LibraryTableSkeleton */
export function LibraryListSkeleton({ rows = 5 }: { rows?: number }) {
  return <LibraryTableSkeleton rows={rows} />
}

/** @deprecated — use LibraryTableSkeleton */
export function LibraryCardSkeleton() {
  return <LibraryRowSkeleton />
}
