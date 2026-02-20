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
      // Gray: Not configured
      'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100':
        validation.status === 'not-configured' && !disabled,

      // Green: Valid
      'border-green-500 bg-green-50 hover:border-green-600 hover:bg-green-100':
        validation.status === 'valid' && !disabled,

      // Red: Invalidated
      'border-red-500 bg-red-50 hover:border-red-600 hover:bg-red-100':
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
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <ValidationIndicator status={validation.status} />
      </div>

      {/* Invalidation banner */}
      {validation.status === 'invalidated' && validation.invalidatedBy && (
        <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded-md text-sm text-red-700">
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
        <div className="mt-2 text-xs text-gray-500">
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
      return <div className="w-3 h-3 rounded-full bg-gray-400" title="Not configured" />

    case 'valid':
      return <CheckCircleIcon className="w-5 h-5 text-green-500" title="Valid configuration" />

    case 'invalidated':
      return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" title="Needs reconfiguration" />

    default:
      return null
  }
}

export default SectionCard
export { ValidationIndicator }
