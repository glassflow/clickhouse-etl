import React from 'react'
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
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="text-center max-w-md">
          <p className="text-red-500 text-sm mb-3">
            Failed to load data for {stepTitle}. {error}
          </p>
          <button onClick={onRetry} className="text-blue-600 hover:text-blue-700 text-sm font-medium underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Image src={Loader} alt="Loading" width={20} height={20} className="animate-spin" />
          <span className="text-sm text-blue-600 font-medium">Loading latest data...</span>
        </div>
        {/* <p className="text-xs text-gray-500 text-center">Fetching event data to enable editing</p> */}
      </div>
    )
  }

  return null
}
