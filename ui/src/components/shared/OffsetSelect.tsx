import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'

export function OffsetSelect({
  value,
  onChange,
  onBlur,
  onOpenChange,
  error,
  placeholder,
  options,
  readOnly,
  standalone,
  label,
}: {
  value: 'earliest' | 'latest'
  onChange: (value: 'earliest' | 'latest') => void
  onBlur: () => void
  onOpenChange: (open: boolean) => void
  error: string
  placeholder: string
  options: { label: string; value: 'earliest' | 'latest' }[]
  readOnly?: boolean
  standalone?: boolean
  label?: string
}) {
  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 mb-2">
        {label && <span className="text-sm text-content">{label}</span>}
      </div>
      <Select
        disabled={readOnly}
        value={value}
        defaultValue={value}
        onValueChange={(value) => {
          onChange(value as 'earliest' | 'latest')
          onBlur()
        }}
        onOpenChange={onOpenChange}
      >
        <SelectTrigger
          error={!!error}
          className="w-full transition-all duration-200 ease-in-out text-content"
          onBlur={() => {
            if (!document.querySelector('[data-state="open"]')) {
              onBlur()
            }
          }}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="select-content-custom animate-fadeIn">
          {options.length === 0 ? (
            <div className="p-2 animate-pulse">No options found</div>
          ) : (
            options.map((option) => {
              return (
                <SelectItem
                  key={`${option.value}`}
                  value={option.value}
                  className="select-item-custom transition-colors duration-150 hover:scale-[1.02] transition-transform text-content"
                >
                  {option.label}
                </SelectItem>
              )
            })
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
