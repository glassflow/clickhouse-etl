export default function PipelinesLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]" aria-busy="true" aria-label="Loading pipelines">
      <div className="text-center">
        <div
          className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"
          role="status"
          aria-hidden
        />
        <p className="text-sm text-content">Loading pipelines...</p>
      </div>
    </div>
  )
}
