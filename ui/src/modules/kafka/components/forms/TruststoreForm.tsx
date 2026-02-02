'use client'

import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { renderFormField } from '@/src/components/ui/form'
import { KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import type { FieldErrors } from 'react-hook-form'
import type { KafkaConnectionFormType } from '@/src/scheme'
import { CertificateFileUpload } from '@/src/components/common/CertificateFileUpload'
import { getFieldError } from './formUtils'

export interface TruststoreFormProps {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
  authMethodPrefix?: string
}

export function TruststoreForm({ errors, readOnly, authMethodPrefix }: TruststoreFormProps) {
  const { register, setValue, watch } = useFormContext()
  const fields = KafkaFormConfig.truststore.fields
  const prefix = authMethodPrefix ? `${authMethodPrefix}.truststore` : 'truststore'

  return (
    <FormGroup className="space-y-4">
      {Object.entries(fields).map(([key, field]: [string, { name: string; label?: string; placeholder?: string; defaultValue?: unknown }]) => {
        const fieldWithPrefix = {
          ...field,
          name: `${prefix}.${key}`,
        }

        if (key === 'location' || key === 'password' || key === 'type' || key === 'algorithm') {
          return null
        }

        if (key === 'certificates') {
          const certificateError = errors ? getFieldError(errors, fieldWithPrefix.name) : undefined
          const fileNameFieldName = `${prefix}.certificatesFileName`

          return (
            <div key={key} className="space-y-2 w-full">
              <label htmlFor={fieldWithPrefix.name} className="block text-sm font-medium text-content">
                {field.label}
              </label>
              <div className="space-y-2">
                <CertificateFileUpload
                  onFileRead={(content, fileName) => {
                    setValue(fieldWithPrefix.name, content, { shouldValidate: true, shouldDirty: true })
                    setValue(fileNameFieldName, fileName, { shouldValidate: false, shouldDirty: true })
                  }}
                  disabled={readOnly}
                  className="w-full"
                  externalError={certificateError}
                  value={watch(fieldWithPrefix.name)}
                  initialFileName={watch(fileNameFieldName)}
                />
              </div>
              <div className="space-y-1 mt-2">
                <label htmlFor={`${fieldWithPrefix.name}-textarea`} className="block text-xs text-content">
                  Or paste certificate content:
                </label>
                <textarea
                  id={`${fieldWithPrefix.name}-textarea`}
                  {...register(fieldWithPrefix.name, { required: false })}
                  placeholder={field.placeholder}
                  className={`w-full min-h-[150px] px-3 py-2 text-sm rounded-md font-mono input-border-regular focus:outline-none focus:border-[var(--color-background-primary,#a5b9e4)] focus:shadow-[0_0_0_2px_rgba(165,185,228,0.25)] ${certificateError ? 'input-border-error' : ''
                    }`}
                  readOnly={readOnly}
                />
              </div>
              {certificateError && <p className="text-sm text-content">{certificateError}</p>}
            </div>
          )
        }

        if (key === 'skipTlsVerification') {
          return (
            <div key={key} className="space-y-2 w-full">
              {renderFormField({
                field: {
                  ...fieldWithPrefix,
                  label: fieldWithPrefix.label ?? '',
                  placeholder: fieldWithPrefix.placeholder ?? '',
                  readOnly: readOnly,
                  defaultValue: field.defaultValue?.toString(),
                },
                register,
                errors,
                readOnly,
              })}
            </div>
          )
        }

        return (
          <div key={key} className="space-y-2 w-full">
            {renderFormField({
              field: {
                ...fieldWithPrefix,
                label: fieldWithPrefix.label ?? '',
                placeholder: fieldWithPrefix.placeholder ?? '',
                defaultValue: field.defaultValue?.toString(),
              },
              register,
              errors,
              readOnly,
            })}
          </div>
        )
      })}
    </FormGroup>
  )
}
