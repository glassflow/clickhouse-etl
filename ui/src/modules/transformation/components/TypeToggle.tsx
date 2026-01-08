import { TransformationField } from '@/src/store/transformation.store'
import { Label } from '@/src/components/ui/label'
import { cn } from '@/src/utils/common.client'

const FastForwardIcon = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.56065 4.10169C1.90375 3.93389 2.31246 3.97617 2.61394 4.21066L11.6139 11.2107C11.8575 11.4001 12 11.6914 12 12C12 12.3086 11.8575 12.5999 11.6139 12.7894L2.61394 19.7894C2.31246 20.0238 1.90375 20.0661 1.56065 19.8983C1.21755 19.7305 1 19.3819 1 19V5.00001C1 4.61807 1.21755 4.2695 1.56065 4.10169ZM12.5606 4.10169C12.9037 3.93389 13.3125 3.97617 13.6139 4.21066L22.6139 11.2107C22.8575 11.4001 23 11.6914 23 12C23 12.3086 22.8575 12.5999 22.6139 12.7894L13.6139 19.7894C13.3125 20.0238 12.9037 20.0661 12.5606 19.8983C12.2176 19.7305 12 19.3819 12 19V12V5.00001C12 4.61807 12.2176 4.2695 12.5606 4.10169ZM3 7.04465V16.9554L9.37118 12L3 7.04465ZM14 7.04465V16.9554L20.3712 12L14 7.04465Z"
      fill="currentColor"
    />
  </svg>
)

const ToolIcon = ({ className }: { className?: string }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16.5578 3.02796C16.0748 2.97339 15.5837 2.9892 15.1001 3.07733C14.1002 3.25952 13.1795 3.74211 12.4608 4.46081C11.7421 5.1795 11.2595 6.10016 11.0773 7.10009C10.8951 8.10001 11.022 9.13172 11.441 10.0577C11.6126 10.4369 11.5314 10.8828 11.2371 11.1771L4.32708 18.0871C4.1168 18.2974 3.99866 18.5826 3.99866 18.88C3.99866 19.1774 4.1168 19.4626 4.32708 19.6729C4.53737 19.8832 4.82259 20.0013 5.11998 20.0013C5.41737 20.0013 5.70258 19.8832 5.91287 19.6729L12.8229 12.7629C13.1172 12.4686 13.563 12.3873 13.9423 12.5589C14.8682 12.978 15.8999 13.1048 16.8999 12.9226C17.8998 12.7404 18.8205 12.2578 19.5391 11.5392C20.2578 10.8205 20.7404 9.8998 20.9226 8.89987C21.0108 8.41622 21.0266 7.92514 20.972 7.44218L18.4 10.0142C18.0262 10.3806 17.5235 10.5858 17 10.5858C16.4765 10.5858 15.9738 10.3806 15.6 10.0141L15.5928 10.0071L13.9858 8.40002C13.6193 8.02616 13.4141 7.52349 13.4141 6.99998C13.4141 6.47647 13.6194 5.97384 13.9858 5.59998L13.9928 5.59284L16.5578 3.02796ZM14.7416 1.10972C16.1415 0.854655 17.5859 1.03228 18.8822 1.61892C19.1813 1.75426 19.3949 2.02777 19.4538 2.35073C19.5126 2.67369 19.4092 3.00496 19.1771 3.23709L15.4142 6.99998L17 8.58577L20.7629 4.82287C20.995 4.59075 21.3263 4.48733 21.6492 4.54618C21.9722 4.60502 22.2457 4.81863 22.381 5.11771C22.9677 6.41409 23.1453 7.85848 22.8902 9.25838C22.6352 10.6583 21.9595 11.9472 20.9534 12.9534C19.9472 13.9595 18.6583 14.6352 17.2584 14.8902C16.0909 15.103 14.8925 15.0147 13.7748 14.6393L7.32708 21.0871C6.74172 21.6724 5.9478 22.0013 5.11998 22.0013C4.29215 22.0013 3.49823 21.6724 2.91287 21.0871C2.32751 20.5017 1.99866 19.7078 1.99866 18.88C1.99866 18.0522 2.32751 17.2582 2.91287 16.6729L9.36063 10.2251C8.98522 9.10743 8.897 7.90903 9.10972 6.74158C9.36478 5.34169 10.0404 4.05277 11.0466 3.0466C12.0528 2.04042 13.3417 1.36478 14.7416 1.10972Z"
      fill="currentColor"
    />
  </svg>
)

function TypeToggle({
  field,
  handleTypeChange,
  readOnly,
}: {
  field: TransformationField
  handleTypeChange: (value: string) => void
  readOnly: boolean
}) {
  const isPassthrough = field.type === 'passthrough'

  return (
    <div>
      <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Type of Field</Label>
      <div className="relative inline-flex rounded-[var(--radius-large)] border border-[var(--surface-border)] p-0.5 bg-[var(--surface-bg-sunken)]">
        {/* Sliding background indicator */}
        <div
          className="absolute top-0.5 bottom-0.5 rounded-[calc(var(--radius-medium)-2px)] bg-[var(--option-bg-selected)] shadow-sm transition-all duration-500 ease-in-out"
          style={{
            left: isPassthrough ? '0.125rem' : 'calc(50% + 0.125rem)',
            right: isPassthrough ? 'calc(50% + 0.125rem)' : '0.125rem',
          }}
        />
        <button
          type="button"
          onClick={() => !readOnly && handleTypeChange('passthrough')}
          disabled={readOnly}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-small rounded-[calc(var(--radius-medium)-2px)] transition-colors duration-500 whitespace-nowrap min-w-[140px]',
            isPassthrough
              ? 'text-[var(--text-accent)]'
              : 'text-[var(--text-disabled)] hover:text-[var(--text-secondary)]',
            readOnly && 'cursor-not-allowed opacity-50',
          )}
        >
          <FastForwardIcon />
          <span className="text-sm font-small whitespace-nowrap">Pass-Through</span>
        </button>
        <button
          type="button"
          onClick={() => !readOnly && handleTypeChange('computed')}
          disabled={readOnly}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-[calc(var(--radius-medium)-2px)] transition-colors duration-500 whitespace-nowrap min-w-[140px]',
            !isPassthrough
              ? 'text-[var(--text-accent)]'
              : 'text-[var(--text-disabled)] hover:text-[var(--text-secondary)]',
            readOnly && 'cursor-not-allowed opacity-50',
          )}
        >
          <ToolIcon />
          <span className="text-sm font-small whitespace-nowrap">Computed</span>
        </button>
      </div>
    </div>
  )
}

export default TypeToggle
