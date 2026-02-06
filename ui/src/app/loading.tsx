export default function RootLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]" aria-busy="true" aria-label="Loading">
      <div className="text-center">
        <div
          className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"
          role="status"
          aria-hidden
        />
        <p className="text-sm text-content">Loading...</p>
      </div>
    </div>
  )
}
