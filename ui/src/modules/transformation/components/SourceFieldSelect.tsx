import { TransformationField } from '@/src/store/transformation.store'
import { FieldValidation } from '../utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Label } from '@/src/components/ui/label'
import { cn } from '@/src/utils/common.client'

function SourceFieldSelect({
  field,
  handleSourceFieldChange,
  readOnly,
  errors,
  availableFields,
  className,
}: {
  field: TransformationField
  handleSourceFieldChange: (value: string) => void
  readOnly: boolean
  errors: FieldValidation['errors']
  availableFields: Array<{ name: string; type: string }>
  className?: string
}) {
  return (
    <div className="flex gap-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
      <div className={cn('flex-1', className)}>
        <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Source Field</Label>
        <Select value={field.sourceField || ''} onValueChange={handleSourceFieldChange} disabled={readOnly}>
          <SelectTrigger
            className={cn(
              'input-regular input-border-regular',
              errors?.sourceField && 'border-[var(--color-border-critical)]',
              className || 'w-full',
            )}
          >
            <SelectValue placeholder="Select source field" />
          </SelectTrigger>
          <SelectContent className="select-content-custom">
            {availableFields.map((f) => (
              <SelectItem key={f.name} value={f.name} className="select-item-custom">
                <span>{f.name}</span>
                <span className="ml-2 text-[var(--text-secondary)]">({f.type})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.sourceField && (
          <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{errors.sourceField}</p>
        )}
      </div>
    </div>
  )
}

export default SourceFieldSelect
