'use client'

import * as React from 'react'
import { useState, useRef, useEffect } from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { Slot } from '@radix-ui/react-slot'
import {
  Controller,
  FormProvider,
  useFormContext,
  UseFormRegister,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  Control,
} from 'react-hook-form'

import { cn } from '@/src/utils'
import { Label } from '@/src/components/ui/label'
import { Input } from './input'
import { Textarea } from './textarea'
import { Select, SelectItem, SelectContent, SelectValue, SelectTrigger } from './select'
import { Switch } from '@/src/components/ui/switch'
const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue)

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn('grid gap-2', className)} {...props} />
    </FormItemContext.Provider>
  )
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn('data-[error=true]:text-destructive-foreground', className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? '') : props.children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn('text-destructive-foreground text-sm', className)}
      {...props}
    >
      {body}
    </p>
  )
}

function FormGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-2', className)} {...props} />
}

function FormError({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-destructive-foreground text-sm', className)} {...props} />
}

function FormSuccess({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-success-foreground text-sm', className)} {...props} />
}

const FormControlInput = <T extends FieldValues>({
  name,
  id,
  label,
  placeholder,
  register,
  required,
  error,
  type = 'text',
  readOnly,
  className,
  noLabel,
}: {
  name: string
  id: string
  label: string
  placeholder: string
  register: UseFormRegister<T>
  required?: string
  error?: string
  type?: string
  readOnly?: boolean
  className?: string
  noLabel?: boolean
}) => {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className={cn('grid gap-2 transition-all duration-200 ease-in-out', className)}>
      {!noLabel && <FormLabel className="transition-colors duration-200 text-content">{label}</FormLabel>}
      <FormControl>
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          {...register(name as any, { required })}
          readOnly={readOnly}
          className={cn(
            'w-full',
            'input-regular',
            'input-border-regular',
            'transition-all duration-200 ease-in-out',
            'text-content',
            error && 'input-border-error',
            isFocused && 'card-gradient-active scale-[1.01]',
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            if (!document.querySelector('[data-state="open"]')) {
              setIsFocused(false)
            }
          }}
        />
      </FormControl>
      {error && (
        <FormMessage className="animate-slideDown transition-opacity duration-200 ease-in-out text-content">
          {error}
        </FormMessage>
      )}
    </div>
  )
}

function FormControlTextarea({
  name,
  className,
  required,
  label,
  placeholder,
  register,
  error,
  noLabel,
  ...props
}: React.ComponentProps<typeof FormGroup> & {
  name: string
  required: string
  label: string
  placeholder: string
  register: UseFormRegister<FieldValues>
  error: string
  noLabel?: boolean
}) {
  const [isFocused, setIsFocused] = useState(false)
  return (
    <div className={cn('grid gap-2 transition-all duration-200 ease-in-out', className)} {...props}>
      {!noLabel && <FormLabel className="transition-colors duration-200 text-content">{label}</FormLabel>}
      <FormControl>
        {/* @ts-expect-error - field is not typed */}
        <Textarea
          {...register(name, { required: required })}
          placeholder={placeholder}
          {...props}
          className={cn(
            'w-full',
            'input-regular',
            'input-border-regular',
            'transition-all duration-200 ease-in-out',
            'text-content',
            error && 'input-border-error',
            isFocused && 'card-gradient-active scale-[1.01]',
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Only blur if the dropdown is closed
            // This prevents losing the focus styles when clicking an option
            if (!document.querySelector('[data-state="open"]')) {
              setIsFocused(false)
            }
          }}
        />
      </FormControl>
      {error && (
        <FormMessage className="animate-slideDown transition-opacity duration-200 ease-in-out text-content">
          {error}
        </FormMessage>
      )}
    </div>
  )
}

function FormControlSelect({
  name,
  className,
  required,
  label,
  placeholder,
  register,
  error,
  type,
  options,
  defaultValue,
  noLabel,
  ...props
}: React.ComponentProps<typeof FormGroup> & {
  name: string
  required: string
  label: string
  placeholder: string
  register: UseFormRegister<FieldValues>
  error: string
  type: string
  options: any[]
  defaultValue?: string
  noLabel?: boolean
}) {
  const [isFocused, setIsFocused] = useState(false)
  const { control, getValues } = useFormContext()

  // Get the current value from the form context
  const currentValue = getValues(name) || defaultValue || ''

  return (
    <div className={cn('space-y-2 w-full min-w-[200px] transition-all duration-200 ease-in-out', className)} {...props}>
      {!noLabel && <FormLabel className="transition-colors duration-200 text-content">{label}</FormLabel>}
      <FormControl>
        <Controller
          name={name}
          control={control}
          defaultValue={currentValue}
          render={({ field }) => {
            return (
              <Select
                value={field.value}
                defaultValue={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  field.onBlur() // Trigger validation
                }}
                onOpenChange={(open) => {
                  setIsFocused(open)
                }}
              >
                <SelectTrigger
                  className={cn(
                    'w-full',
                    'input-regular',
                    'input-border-regular',
                    'transition-all duration-200 ease-in-out',
                    'text-content',
                    error && 'input-border-error',
                    isFocused && 'card-gradient-active scale-[1.01]',
                  )}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => {
                    if (!document.querySelector('[data-state="open"]')) {
                      setIsFocused(false)
                      field.onBlur() // Trigger validation on blur
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
                          key={`${name}-${option.value}`}
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
            )
          }}
        />
      </FormControl>
      {error && (
        <FormMessage className="animate-slideDown transition-opacity duration-200 ease-in-out">{error}</FormMessage>
      )}
    </div>
  )
}

function FormControlSwitch({
  name,
  className,
  label,
  register,
  error,
  noLabel,
  ...props
}: React.ComponentProps<typeof FormGroup> & {
  name: string
  label: string
  register: UseFormRegister<FieldValues>
  error: string
  noLabel?: boolean
}) {
  const [isChecked, setIsChecked] = useState(false)
  const { control } = useFormContext()

  return (
    <div className={cn('grid gap-2 transition-all duration-200 ease-in-out', className)} {...props}>
      {!noLabel && <FormLabel className="transition-colors duration-200 text-content">{label}</FormLabel>}
      <FormControl>
        <Controller
          name={name}
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked)
                setIsChecked(checked)
              }}
              className={cn(
                'data-[state=checked]:bg-[var(--primary)]',
                'data-[state=unchecked]:bg-[var(--background)]',
                'transition-colors duration-200 ease-in-out',
              )}
            />
          )}
        />
      </FormControl>
      {error && (
        <FormMessage className="animate-slideDown transition-opacity duration-200 ease-in-out text-content">
          {error}
        </FormMessage>
      )}
    </div>
  )
}

const typeMap = {
  text: FormControlInput,
  textarea: FormControlTextarea,
  select: FormControlSelect,
  number: FormControlInput,
  boolean: FormControlSwitch,
}

function getFieldError(errors: any, path: string): string | undefined {
  if (!errors) return undefined
  if (!path) return undefined

  const parts = path?.split('.')
  let current = errors

  for (const part of parts) {
    if (!current[part]) return undefined
    current = current[part]
  }

  return current.message ? current.message : undefined
}

function getOptions(name: string, dynamicOptions: any, options: any) {
  if (dynamicOptions && dynamicOptions[name] && dynamicOptions[name].length > 0) {
    return dynamicOptions[name]
  }
  return options || []
}

export function useRenderFormFields({
  formConfig,
  formGroupName,
  register,
  errors,
  dynamicOptions,
  key,
  values,
  hiddenFields,
}: {
  formConfig: any
  formGroupName: string
  register: any
  errors: any
  dynamicOptions?: any
  key?: string
  values?: Record<string, any>
  hiddenFields?: string[]
}) {
  const { control, getValues } = useFormContext()
  const config: Record<string, any> = formConfig[formGroupName as keyof typeof formConfig]
  const formFields = Object.values(config.fields as Record<string, any>)

  // Create a ref to track if this is the first render
  const isFirstRender = React.useRef(true)

  // Use effect to log when dynamic options change
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
    }
  }, [dynamicOptions, formFields])

  return (
    <div key={key || `${formGroupName}-${Object.keys(dynamicOptions || {}).length}`} className="space-y-6">
      {formFields.map(
        (
          field: {
            name: string
            label: string
            placeholder: string
            required?: string
            type?: string
            options?: any
            defaultValue?: string
            noLabel?: boolean
          },
          index: number,
        ) => {
          if (hiddenFields?.includes(field.name)) return null
          const { name, label, placeholder, required, type, options, defaultValue, noLabel } = field
          const Component = typeMap[type as keyof typeof typeMap] || FormControlInput
          const fieldOptions = getOptions(name, dynamicOptions, options)

          // Use external value if provided, otherwise use default
          const fieldValue = values?.[name] !== undefined ? values[name] : defaultValue || ''

          return (
            <div
              className="transition-all duration-300 ease-in-out"
              style={{
                animationDelay: `${index * 50}ms`,
                opacity: 0,
                animation: 'fadeIn 0.3s forwards',
              }}
              key={`${name}-${fieldOptions.length}-${fieldValue}-${index}`}
            >
              <Component
                name={name}
                id={name}
                label={label}
                placeholder={placeholder}
                register={register}
                required={required || ''}
                error={getFieldError(errors, name) || ''}
                type={type || 'text'}
                options={fieldOptions}
                defaultValue={fieldValue}
                noLabel={noLabel}
              />
            </div>
          )
        },
      )}
    </div>
  )
}

export function renderFormField<T extends FieldValues>({
  field,
  register,
  errors,
  dynamicOptions,
  values,
  control,
  onChange,
}: {
  field: {
    name: string
    label: string
    placeholder: string
    required?: string
    options?: any[]
    defaultValue?: string
    onChange?: (value: any) => void
    readOnly?: boolean
    className?: string
    type?: string
    noLabel?: boolean
  }
  register: UseFormRegister<T>
  errors: any
  dynamicOptions?: Record<string, any[]>
  values?: Record<string, any>
  control?: Control<T>
  onChange?: (value: any) => void
}) {
  const { name, label, placeholder, required, type = 'text', options, defaultValue, noLabel } = field
  const Component = typeMap[type as keyof typeof typeMap] || FormControlInput

  const fieldOptions =
    dynamicOptions && dynamicOptions[name] && dynamicOptions[name].length > 0 ? dynamicOptions[name] : options || []

  const fieldValue = values?.[name] !== undefined ? values[name] : defaultValue || ''
  const fieldError = getFieldError(errors, name) || ''

  if (type === 'text') {
    return (
      <FormControlInput
        name={name}
        id={name}
        label={label}
        placeholder={placeholder}
        register={register as any}
        required={required || ''}
        error={fieldError}
        type={type}
        readOnly={field.readOnly}
        className={field.className}
        noLabel={noLabel}
      />
    )
  }

  return (
    <div
      className="transition-all duration-300 ease-in-out"
      style={{
        opacity: 0,
        animation: 'fadeIn 0.3s forwards',
      }}
    >
      <Component
        name={name}
        id={name}
        label={label}
        placeholder={placeholder}
        register={register as any}
        required={required || ''}
        error={fieldError}
        type={type}
        options={fieldOptions}
        defaultValue={fieldValue}
        noLabel={noLabel}
      />
    </div>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  FormGroup,
  FormProvider,
  FormError,
  FormSuccess,
  FormControlInput,
  FormControlTextarea,
  FormControlSelect,
  FormControlSwitch,
}
