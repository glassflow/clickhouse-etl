import { Label } from '@/src/components/ui/label'
import { cn } from '@/src/utils/common.client'

const FieldIcon = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 3C2.44772 3 2 3.44772 2 4V20C2 20.5523 2.44772 21 3 21H21C21.5523 21 22 20.5523 22 20V4C22 3.44772 21.5523 3 21 3H3ZM4 5V19H20V5H4ZM6 7H18C18.5523 7 19 7.44772 19 8V16C19 16.5523 18.5523 17 18 17H6C5.44772 17 5 16.5523 5 16V8C5 7.44772 5.44772 7 6 7ZM7 9V15H17V9H7Z"
      fill="currentColor"
    />
  </svg>
)

const ValueIcon = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12ZM12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6ZM8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12Z"
      fill="currentColor"
    />
  </svg>
)

interface FieldValueToggleProps {
  value: 'field' | 'literal'
  onChange: (value: 'field' | 'literal') => void
  disabled?: boolean
  label?: string
  className?: string
}

export function FieldValueToggle({ value, onChange, disabled = false, label, className }: FieldValueToggleProps) {
  const isField = value === 'field'

  return (
    <div className={className}>
      {label && <Label className="text-xs text-[var(--text-secondary)] mb-1 block">{label}</Label>}
      <div className="relative inline-flex rounded-[var(--radius-large)] border border-[var(--surface-border)] p-0.5 bg-[var(--surface-bg-sunken)]">
        {/* Sliding background indicator */}
        <div
          className="absolute top-0.5 bottom-0.5 rounded-[calc(var(--radius-medium)-2px)] bg-[var(--option-bg-selected)] shadow-sm transition-all duration-500 ease-in-out"
          style={{
            left: isField ? '0.125rem' : 'calc(50% + 0.125rem)',
            right: isField ? 'calc(50% + 0.125rem)' : '0.125rem',
          }}
        />
        <button
          type="button"
          onClick={() => !disabled && onChange('field')}
          disabled={disabled}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-small rounded-[calc(var(--radius-medium)-2px)] transition-colors duration-500 whitespace-nowrap min-w-[100px]',
            isField ? 'text-[var(--text-accent)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-secondary)]',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <FieldIcon />
          <span className="text-sm font-small whitespace-nowrap">Field</span>
        </button>
        <button
          type="button"
          onClick={() => !disabled && onChange('literal')}
          disabled={disabled}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-[calc(var(--radius-medium)-2px)] transition-colors duration-500 whitespace-nowrap min-w-[100px]',
            !isField ? 'text-[var(--text-accent)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-secondary)]',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <ValueIcon />
          <span className="text-sm font-small whitespace-nowrap">Value</span>
        </button>
      </div>
    </div>
  )
}

export default FieldValueToggle
