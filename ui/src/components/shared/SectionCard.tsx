import React from 'react'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { cn } from '@/src/utils/common.client'
import { ValidationState } from '@/src/types/validation'

interface SectionCardProps {
  validation: ValidationState
  title: string
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

const SectionCard = ({ validation, title, children, onClick, disabled = false, className }: SectionCardProps) => {
  const cardStyles = cn(
    'relative p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer',
    {
      // Not configured: neutral
      'border-[var(--color-border-neutral-faded)] bg-[var(--color-background-neutral-faded)] hover:border-[var(--color-border-neutral)] hover:bg-[var(--color-background-neutral)]':
        validation.status === 'not-configured' && !disabled,

      // Valid: positive
      'border-[var(--color-border-positive)] bg-[var(--color-background-positive-faded)] hover:border-[var(--color-border-positive)] hover:bg-[var(--color-background-positive)]':
        validation.status === 'valid' && !disabled,

      // Invalidated: critical
      'border-[var(--color-border-critical)] bg-[var(--color-background-critical-faded)] hover:border-[var(--color-border-critical)] hover:bg-[var(--color-background-critical)]':
        validation.status === 'invalidated' && !disabled,

      // Disabled state
      'opacity-50 cursor-not-allowed': disabled,
      'cursor-default': !onClick || disabled,
    },
    className,
  )

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
    }
  }

  return (
    <div className={cardStyles} onClick={handleClick}>
      {/* Status indicator and title */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-[var(--color-foreground-neutral)]">{title}</h3>
        <ValidationIndicator status={validation.status} />
      </div>

      {/* Invalidation banner */}
      {validation.status === 'invalidated' && validation.invalidatedBy && (
        <div className="mb-3 p-2 bg-[var(--color-background-critical-faded)] border border-[var(--color-border-critical)] rounded-md text-sm text-[var(--color-foreground-critical)]">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>
              Configuration invalidated by changes in <span className="font-medium">{validation.invalidatedBy}</span>
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex items-center justify-center">{children}</div>

      {/* Last modified indicator */}
      {validation.lastModified && (
        <div className="mt-2 text-xs text-[var(--color-foreground-neutral-faded)]">
          Last updated: {new Date(validation.lastModified).toLocaleString()}
        </div>
      )}
    </div>
  )
}

/**
 * Visual status indicator component
 */
const ValidationIndicator = ({ status }: { status: ValidationState['status'] }) => {
  switch (status) {
    case 'not-configured':
      return (
        <div
          className="w-3 h-3 rounded-full bg-[var(--color-foreground-disabled)]"
          title="Not configured"
        />
      )

    case 'valid':
      return (
        <CheckCircleIcon
          className="w-5 h-5 text-[var(--color-foreground-positive)]"
          title="Valid configuration"
        />
      )

    case 'invalidated':
      return (
        <ExclamationTriangleIcon
          className="w-5 h-5 text-[var(--color-foreground-critical)]"
          title="Needs reconfiguration"
        />
      )

    default:
      return null
  }
}

export default SectionCard
export { ValidationIndicator }
