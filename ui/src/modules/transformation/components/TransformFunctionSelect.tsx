import { TransformationField } from '@/src/store/transformation.store'
import { FieldValidation } from '../utils'
import { Label } from '@/src/components/ui/label'
import { FunctionSelector } from './FunctionSelector'
import { Input } from '@/src/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { TransformationFunctionDef } from '../functions'

function TransformFunctionSelect({
  field,
  handleFunctionChange,
  readOnly,
  errors,
  availableFields,
  functionDef,
  getArgValue,
  handleArgChange,
}: {
  field: TransformationField
  handleFunctionChange: (value: string) => void
  readOnly: boolean
  errors: FieldValidation['errors']
  availableFields: Array<{ name: string; type: string }>
  functionDef: TransformationFunctionDef
  getArgValue: (argIndex: number) => string
  handleArgChange: (argIndex: number, value: string, argType: 'field' | 'literal' | 'array') => void
}) {
  return (
    <div className="flex gap-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
      <div className="flex-1">
        <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Function</Label>
        <FunctionSelector
          value={field.functionName || ''}
          onSelect={handleFunctionChange}
          disabled={readOnly}
          error={errors?.functionName}
        />
        {errors?.functionName && (
          <p className="text-xs text-[var(--color-foreground-critical)] mt-1">{errors.functionName}</p>
        )}
      </div>

      <div className="border-[var(--surface-border)] flex-2">
        <Label className="text-xs text-[var(--text-secondary)] mb-1 block">Arguments</Label>
        <div className="flex gap-2">
          {functionDef.args.map((argDef, argIndex) => (
            <div key={argIndex} className="flex-1 gap-2 items-center">
              {/* <span className="text-xs text-[var(--text-secondary)] w-24">{argDef.name}:</span> */}
              {argDef.type === 'field' ? (
                <div className="flex-1">
                  <Select
                    value={getArgValue(argIndex)}
                    onValueChange={(v) => handleArgChange(argIndex, v, 'field')}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="flex-1 input-regular input-border-regular h-8 text-sm w-full">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent className="select-content-custom">
                      {availableFields
                        .filter((f) => !argDef.fieldTypes || argDef.fieldTypes.includes(f.type))
                        .map((f) => (
                          <SelectItem key={f.name} value={f.name} className="select-item-custom text-sm">
                            {f.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex-1">
                  <Input
                    value={getArgValue(argIndex)}
                    onChange={(e) => handleArgChange(argIndex, e.target.value, 'literal')}
                    placeholder={argDef.description}
                    disabled={readOnly}
                    className="flex-1 input-regular input-border-regular h-8 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
          {errors?.functionArgs && (
            <p className="text-xs text-[var(--color-foreground-critical)]">{errors.functionArgs}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default TransformFunctionSelect
