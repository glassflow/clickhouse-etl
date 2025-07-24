import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { renderFormField } from '@/src/components/ui/form'
import { ClickhouseConnectionFormConfig } from '@/src/config/clickhouse-connection-form-config'
import { FieldErrors } from 'react-hook-form'
import { ClickhouseConnectionFormType } from '@/src/scheme/clickhouse.scheme'
import { useEffect, useState } from 'react'

// Direct connection form - renders all ClickHouse connection fields
const ClickhouseDirectConnectionForm = ({
  errors,
  readOnly,
  isLoading,
}: {
  errors?: FieldErrors<ClickhouseConnectionFormType>
  readOnly?: boolean
  isLoading?: boolean
}) => {
  const { register } = useFormContext()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const { directConnectionForm } = ClickhouseConnectionFormConfig

  return (
    <FormGroup
      className={`space-y-4 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {renderFormField({
            field: {
              ...directConnectionForm.fields.host,
              readOnly: isLoading,
            },
            register,
            errors,
            readOnly,
          })}
        </div>

        <div className="space-y-2">
          {renderFormField({
            field: {
              ...directConnectionForm.fields.port,
              readOnly: isLoading,
            },
            register,
            errors,
            readOnly,
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {renderFormField({
            field: {
              ...directConnectionForm.fields.username,
              readOnly: isLoading,
            },
            register,
            errors,
            readOnly,
          })}
        </div>

        <div className="space-y-2">
          {renderFormField({
            field: {
              ...directConnectionForm.fields.password,
              readOnly: isLoading,
            },
            register,
            errors,
            readOnly,
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {renderFormField({
            field: {
              ...directConnectionForm.fields.nativePort,
              readOnly: isLoading,
            },
            register,
            errors,
            readOnly,
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {renderFormField({
            field: {
              ...directConnectionForm.fields.useSSL,
              readOnly: isLoading,
              defaultValue: directConnectionForm.fields.useSSL.defaultValue?.toString(),
            },
            register,
            errors,
            readOnly,
          })}
        </div>

        <div className="space-y-2">
          {renderFormField({
            field: {
              ...directConnectionForm.fields.skipCertificateVerification,
              readOnly: isLoading,
              defaultValue: directConnectionForm.fields.skipCertificateVerification.defaultValue?.toString(),
            },
            register,
            errors,
            readOnly,
          })}
        </div>
      </div>
    </FormGroup>
  )
}

// Main component that renders the ClickHouse connection form
export const ClickhouseConnectionFormRenderer = ({
  errors,
  readOnly,
  isLoading,
}: {
  errors: FieldErrors<ClickhouseConnectionFormType>
  readOnly?: boolean
  isLoading?: boolean
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`space-y-4 md:space-y-6 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <ClickhouseDirectConnectionForm errors={errors} readOnly={readOnly} isLoading={isLoading} />
    </div>
  )
}
