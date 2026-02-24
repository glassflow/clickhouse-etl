import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/src/components/ui/form'
import { Input } from '@/src/components/ui/input'

export function FormItemInput({
  field,
  form,
  label,
  placeholder,
  description,
  type = 'text',
}: {
  field: any
  form: any
  label: string
  placeholder: string
  description?: string
  type?: string
}) {
  const hasError = !!form.formState.errors[field.name]

  return (
    <FormItem>
      <FormLabel className="input-label">{label}</FormLabel>
      <FormControl>
        <Input
          type={type}
          placeholder={placeholder}
          {...field}
          error={hasError}
        />
      </FormControl>
      {description && <FormDescription className="input-description-error">{description}</FormDescription>}
      <FormMessage className="input-description-error" />
    </FormItem>
  )
}
