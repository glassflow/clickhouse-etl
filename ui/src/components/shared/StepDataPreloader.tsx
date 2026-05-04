import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'

interface StepDataPreloaderProps {
  isLoading: boolean
  error: string | null
  progress: {
    current: number
    total: number
    description: string
  }
  onRetry: () => void
  stepTitle: string
}

export function StepDataPreloader({ isLoading, error, progress, onRetry, stepTitle }: StepDataPreloaderProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 gap-3">
        <p className="body-3 text-[var(--color-foreground-critical)] text-center max-w-md">
          Failed to load data for {stepTitle}. {error}
        </p>
        <button
          onClick={onRetry}
          className="caption-1 text-[var(--color-foreground-primary)] hover:underline"
        >
          Try again →
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Image src={Loader} alt="Loading" width={20} height={20} className="animate-spin" />
          <span className="body-3 text-[var(--color-foreground-primary)] font-medium">Loading…</span>
        </div>
      </div>
    )
  }

  return null
}
