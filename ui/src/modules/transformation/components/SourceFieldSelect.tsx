import { TransformationField } from '@/src/store/transformation.store'
import { FieldValidation } from '../utils'
import { Label } from '@/src/components/ui/label'
import { FieldSelectCombobox } from './FieldSelectCombobox'
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
        <FieldSelectCombobox
          value={field.sourceField || ''}
          onValueChange={handleSourceFieldChange}
          availableFields={availableFields}
          placeholder="Select source field"
          disabled={readOnly}
          error={Boolean(errors?.sourceField)}
          className={className}
        />
        {errors?.sourceField && (
          <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{errors.sourceField}</p>
        )}
      </div>
    </div>
  )
}

export default SourceFieldSelect
