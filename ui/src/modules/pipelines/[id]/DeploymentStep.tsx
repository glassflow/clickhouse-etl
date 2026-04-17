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
    if (isFailed) return <XCircleIcon className="w-5 h-5" />
    if (isCompleted) return <CheckCircleIcon className="w-5 h-5" />
    if (isActive) return <LoadingSpinner size="sm" />
    return <div className="w-5 h-5 rounded-full border-2 border-[var(--color-foreground-neutral-faded)]" />
  }

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg border transition-all duration-500 ease-in-out',
        isActive && 'border-[var(--color-border-primary-faded)] bg-[var(--color-background-primary-faded)]',
        isCompleted && !isFailed && 'border-[var(--color-border-positive-faded)] bg-[var(--color-background-positive-faded)]',
        isFailed && 'border-[var(--color-border-critical-faded)] bg-[var(--color-background-critical-faded)]',
        !isActive && !isCompleted && !isFailed && 'border-[var(--surface-border)] bg-[var(--surface-bg)]',
      )}
    >
      <div
        className={cn(
          'shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
          isActive && 'bg-[var(--color-background-primary)] text-[var(--color-on-background-primary)]',
          isCompleted && !isFailed && 'bg-[var(--color-background-positive)] text-[var(--color-on-background-primary)]',
          isFailed && 'bg-[var(--color-background-critical)] text-[var(--color-on-background-primary)]',
          !isActive && !isCompleted && !isFailed && 'bg-[var(--color-background-neutral-faded)] text-[var(--color-foreground-neutral-faded)]',
        )}
      >
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              'body-2 font-semibold transition-colors duration-300',
              isActive && 'text-[var(--color-foreground-primary)]',
              isCompleted && !isFailed && 'text-[var(--color-foreground-positive)]',
              isFailed && 'text-[var(--color-foreground-critical)]',
              !isActive && !isCompleted && !isFailed && 'text-[var(--color-foreground-neutral-faded)]',
            )}
          >
            {title}
          </h3>
          {timestamp && (
            <span className="caption-1 text-[var(--color-foreground-neutral-faded)] shrink-0">
              {timestamp.toLocaleTimeString()}
            </span>
          )}
        </div>

        <p
          className={cn(
            'caption-1 mt-1 transition-colors duration-300',
            isActive && 'text-[var(--color-foreground-primary)]',
            isCompleted && !isFailed && 'text-[var(--color-foreground-positive-faded)]',
            isFailed && 'text-[var(--color-foreground-critical-faded)]',
            !isActive && !isCompleted && !isFailed && 'text-[var(--color-foreground-neutral-faded)]',
          )}
        >
          {description}
        </p>

        {isActive && (phase === 'deploying' || phase === 'created') && (
          <div className="mt-2">
            <div className="caption-1 text-[var(--color-foreground-primary)] font-medium animate-pulse">
              {phase === 'deploying' ? 'This may take a few minutes…' : 'Initializing deployment…'}
            </div>
            {phase === 'deploying' && (
              <div className="w-full bg-[var(--color-background-primary-faded)] rounded-full h-1 mt-1.5">
                <div
                  className="bg-[var(--color-background-primary)] h-1 rounded-full animate-pulse"
                  style={{ width: '60%' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DeploymentStep
