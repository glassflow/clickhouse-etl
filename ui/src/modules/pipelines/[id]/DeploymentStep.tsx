import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/src/components/shared/LoadingSpinner'
import { cn } from '@/src/utils/common.client'

export type DeploymentPhase = 'created' | 'deploying' | 'deployed' | 'failed'

interface DeploymentStepProps {
  phase: DeploymentPhase
  isActive: boolean
  isCompleted: boolean
  isFailed?: boolean
  title: string
  description: string
  timestamp?: Date
}

const DeploymentStep = ({
  phase,
  isActive,
  isCompleted,
  isFailed = false,
  title,
  description,
  timestamp,
}: DeploymentStepProps) => {
  const getIcon = () => {
    if (isFailed) {
      return <XCircleIcon className="w-5 h-5" />
    }
    if (isCompleted) {
      return <CheckCircleIcon className="w-5 h-5" />
    }
    if (isActive) {
      return <LoadingSpinner size="sm" color="blue" />
    }
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
  }

  const getStatusColor = () => {
    if (isFailed) return 'red'
    if (isCompleted) return 'green'
    if (isActive) return 'blue'
    return 'gray'
  }

  const statusColor = getStatusColor()

  return (
    <div
      className={cn(
        'flex items-center space-x-4 p-4 rounded-lg transition-all duration-500 ease-in-out',
        isActive && 'bg-blue-50 border-l-4 border-blue-500 shadow-sm',
        isCompleted && !isFailed && 'bg-green-50 border-l-4 border-green-500',
        isFailed && 'bg-red-50 border-l-4 border-red-500',
        !isActive && !isCompleted && !isFailed && 'bg-gray-50',
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
          isActive && 'bg-blue-500 text-white',
          isCompleted && !isFailed && 'bg-green-500 text-white',
          isFailed && 'bg-red-500 text-white',
          !isActive && !isCompleted && !isFailed && 'bg-gray-200 text-gray-500',
        )}
      >
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3
            className={cn(
              'font-semibold text-lg transition-colors duration-300',
              statusColor === 'blue' && 'text-blue-900',
              statusColor === 'green' && 'text-green-900',
              statusColor === 'red' && 'text-red-900',
              statusColor === 'gray' && 'text-gray-600',
            )}
          >
            {title}
          </h3>
          {timestamp && <span className="text-sm text-gray-500">{timestamp.toLocaleTimeString()}</span>}
        </div>

        <p
          className={cn(
            'text-sm mt-1 transition-colors duration-300',
            statusColor === 'blue' && 'text-blue-700',
            statusColor === 'green' && 'text-green-700',
            statusColor === 'red' && 'text-red-700',
            statusColor === 'gray' && 'text-gray-600',
          )}
        >
          {description}
        </p>

        {isActive && phase === 'deploying' && (
          <div className="mt-2 animate-pulse">
            <div className="text-xs text-blue-600 font-medium">This may take a few minutes...</div>
            <div className="w-full bg-blue-200 rounded-full h-1 mt-1">
              <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}

        {isActive && phase === 'created' && (
          <div className="mt-2">
            <div className="text-xs text-blue-600 font-medium animate-pulse">Initializing deployment...</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeploymentStep
