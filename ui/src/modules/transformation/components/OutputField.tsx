import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { cn } from '@/src/utils/common.client'
import { TransformationField } from '@/src/store/transformation.store'
import { FieldValidation } from '../utils'

function OutputField({
  field,
  handleOutputNameChange,
  readOnly,
  errors,
}: {
  field: TransformationField
  handleOutputNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  readOnly: boolean
  errors: FieldValidation['errors']
}) {
  return (
    <div className="flex-1">
      <div className="flex gap-4">
        {/* Output field name */}
        <div className="flex-1">
          <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Output Field Name</Label>
          <Input
            value={field.outputFieldName}
            onChange={handleOutputNameChange}
            placeholder="Enter field name"
            disabled={readOnly}
            className={cn(
              'input-regular input-border-regular',
              errors?.outputFieldName && 'border-[var(--color-border-critical)]',
            )}
          />
          {errors?.outputFieldName && (
            <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{errors.outputFieldName}</p>
          )}
        </div>

        {/* Output type (read-only) */}
        <div className="w-32">
          <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Output Type</Label>
          <div className="input-regular input-border-regular text-sm h-10 flex items-center px-3 text-[var(--text-secondary)] bg-[var(--surface-bg-sunken)]">
            {field.outputFieldType || 'auto'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OutputField
