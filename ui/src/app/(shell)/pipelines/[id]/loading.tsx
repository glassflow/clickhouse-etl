import { Skeleton } from '@/src/components/ui/skeleton'

/**
 * Layout-shape-preserving fallback for pipeline detail tabs. The Suspense
 * boundary set in `layout.tsx` shows this while the tab page resolves; we
 * render placeholder blocks roughly matching the populated layout (header
 * + content area) instead of a centered spinner so the page doesn't jump
 * once the data lands.
 */
export default function PipelineDetailsLoading() {
  return (
    <div
      className="flex flex-col gap-4 p-2"
      aria-busy="true"
      aria-label="Loading pipeline"
    >
      <div className="flex flex-col gap-2">
        <Skeleton width={200} height={20} />
        <Skeleton width={320} height={32} />
      </div>
      <div className="flex flex-col gap-3 mt-4">
        <Skeleton width="100%" height={120} />
        <Skeleton width="100%" height={240} />
      </div>
    </div>
  )
}
