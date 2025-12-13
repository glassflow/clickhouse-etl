'use client'

import { ExpressionMode } from '@/src/store/transformation.store'
import { Label } from '@/src/components/ui/label'
import { cn } from '@/src/utils/common.client'

// Icon for Simple mode
const SimpleIcon = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V8C20 9.10457 19.1046 10 18 10H6C4.89543 10 4 9.10457 4 8V6ZM6 6H18V8H6V6ZM4 16C4 14.8954 4.89543 14 6 14H12C13.1046 14 14 14.8954 14 16V18C14 19.1046 13.1046 20 12 20H6C4.89543 20 4 19.1046 4 18V16ZM6 16H12V18H6V16Z"
      fill="currentColor"
    />
  </svg>
)

// Icon for Nested mode
const NestedIcon = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 4C2 2.89543 2.89543 2 4 2H20C21.1046 2 22 2.89543 22 4V6C22 7.10457 21.1046 8 20 8H4C2.89543 8 2 7.10457 2 6V4ZM4 4H20V6H4V4ZM6 10C4.89543 10 4 10.8954 4 12V14C4 15.1046 4.89543 16 6 16H18C19.1046 16 20 15.1046 20 14V12C20 10.8954 19.1046 10 18 10H6ZM6 12H18V14H6V12ZM8 18C6.89543 18 6 18.8954 6 20V22H8V20H16V22H18V20C18 18.8954 17.1046 18 16 18H8Z"
      fill="currentColor"
    />
  </svg>
)

// Icon for Expression/Raw mode
const ExpressionIcon = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.4473 3.10557C14.786 3.27497 15 3.62123 15 4V11H19C19.3788 11 19.725 11.214 19.8944 11.5528C20.0638 11.8916 20.0273 12.297 19.8 12.6L11.8 23.6C11.5573 23.924 11.142 24.0663 10.7527 23.9642C10.3635 23.862 10.0648 23.5346 10.0067 23.1367L9.15073 17H5C4.62122 17 4.27497 16.786 4.10557 16.4472C3.93617 16.1084 3.97274 15.703 4.2 15.4L12.2 4.4C12.4427 4.07601 12.858 3.93369 13.2473 4.03578C13.6365 4.13787 13.9352 4.46538 13.9933 4.86334L14.8493 11H19V13H14C13.6212 13 13.275 12.786 13.1056 12.4472C12.9362 12.1084 12.9727 11.703 13.2 11.4L17.5 6H13V4L9.5 8H5V6H9C9.37878 6 9.72503 6.21399 9.89443 6.55279C10.0638 6.8916 10.0273 7.29697 9.8 7.6L5.5 12H10C10.3788 12 10.725 12.214 10.8944 12.5528C11.0638 12.8916 11.0273 13.297 10.8 13.6L6.5 19H11L11.8493 24.8633L19.5 14H15L14.1507 8.13666L6.5 17H10V15H15V13H10C9.62122 13 9.27497 12.786 9.10557 12.4472C8.93617 12.1084 8.97274 11.703 9.2 11.4L13.5 6H9V8L12.5 4H17V6H13C12.6212 6 12.275 6.21399 12.1056 6.55279C11.9362 6.8916 11.9727 7.29697 11.8 7.6L7.5 12H12L12.8493 17.8633L17.5 12H13V14H7V16H12C12.3788 16 12.725 16.214 12.8944 16.5528C13.0638 16.8916 13.0273 17.297 12.8 17.6L8.5 22H13L13.8493 16.8633L18.5 11H14V4Z"
      fill="currentColor"
    />
  </svg>
)

// Simpler code icon for Expression mode
const CodeIcon = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.70711 3.29289C9.09763 3.68342 9.09763 4.31658 8.70711 4.70711L4.41421 9L8.70711 13.2929C9.09763 13.6834 9.09763 14.3166 8.70711 14.7071C8.31658 15.0976 7.68342 15.0976 7.29289 14.7071L2.29289 9.70711C1.90237 9.31658 1.90237 8.68342 2.29289 8.29289L7.29289 3.29289C7.68342 2.90237 8.31658 2.90237 8.70711 3.29289ZM15.2929 3.29289C15.6834 2.90237 16.3166 2.90237 16.7071 3.29289L21.7071 8.29289C22.0976 8.68342 22.0976 9.31658 21.7071 9.70711L16.7071 14.7071C16.3166 15.0976 15.6834 15.0976 15.2929 14.7071C14.9024 14.3166 14.9024 13.6834 15.2929 13.2929L19.5858 9L15.2929 4.70711C14.9024 4.31658 14.9024 3.68342 15.2929 3.29289ZM14.4472 17.1056C14.786 17.2749 15 17.6212 15 18V20H9V18C9 17.6212 9.21399 17.275 9.55279 17.1056C9.8916 16.9362 10.297 16.9727 10.6 17.2L12 18.3333L13.4 17.2C13.703 16.9727 14.1084 16.9362 14.4472 17.1056Z"
      fill="currentColor"
    />
  </svg>
)

interface ExpressionModeToggleProps {
  mode: ExpressionMode
  onChange: (mode: ExpressionMode) => void
  disabled?: boolean
}

export function ExpressionModeToggle({ mode, onChange, disabled = false }: ExpressionModeToggleProps) {
  const modes: { value: ExpressionMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { value: 'simple', label: 'Simple', icon: SimpleIcon },
    { value: 'nested', label: 'Nested', icon: NestedIcon },
    { value: 'raw', label: 'Expression', icon: CodeIcon },
  ]

  // Calculate position for sliding indicator
  const getSlidePosition = () => {
    const index = modes.findIndex((m) => m.value === mode)
    const width = 100 / modes.length
    return {
      left: `calc(${index * width}% + 0.125rem)`,
      width: `calc(${width}% - 0.25rem)`,
    }
  }

  const slidePos = getSlidePosition()

  return (
    <div>
      <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Mode</Label>
      <div className="relative inline-flex rounded-[var(--radius-large)] border border-[var(--surface-border)] p-0.5 bg-[var(--surface-bg-sunken)]">
        {/* Sliding background indicator */}
        <div
          className="absolute top-0.5 bottom-0.5 rounded-[calc(var(--radius-medium)-2px)] bg-[var(--option-bg-selected)] shadow-sm transition-all duration-500 ease-in-out"
          style={{
            left: slidePos.left,
            width: slidePos.width,
          }}
        />
        {modes.map((m) => {
          const Icon = m.icon
          const isActive = mode === m.value
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => !disabled && onChange(m.value)}
              disabled={disabled}
              className={cn(
                'relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-small rounded-[calc(var(--radius-medium)-2px)] transition-colors duration-500 whitespace-nowrap min-w-[90px]',
                isActive
                  ? 'text-[var(--text-accent)]'
                  : 'text-[var(--text-disabled)] hover:text-[var(--text-secondary)]',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <Icon />
              <span className="text-sm font-small whitespace-nowrap">{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ExpressionModeToggle
