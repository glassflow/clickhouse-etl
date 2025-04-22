import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/src/components/ui/form'
import { Input } from '@/src/components/ui/input'
import { cn } from '@/src/utils'
import { useState } from 'react'

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
  // Use local state to track focus instead of form state
  const [isFocused, setIsFocused] = useState(false)

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input
          type={type}
          placeholder={placeholder}
          {...field}
          className={cn(
            'input-regular',
            'input-border-regular',
            form.formState.errors[field.name] && 'input-border-error',
            // Use local state for focus
            isFocused && 'card-gradient-active',
          )}
          // Simplified focus/blur handlers
          onFocus={(e) => {
            if (field.onFocus) field.onFocus(e)
            setIsFocused(true)
          }}
          onBlur={(e) => {
            if (field.onBlur) field.onBlur(e)
            setIsFocused(false)
          }}
        />
      </FormControl>
      {description && <FormDescription className="input-description-error">{description}</FormDescription>}
      <FormMessage className="text-red-500" />
    </FormItem>
  )
}
