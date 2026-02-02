'use client'

import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { InputFile } from '@/src/components/common/InputFile'
import { renderFormField } from '@/src/components/ui/form'
import { KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import type { FieldErrors } from 'react-hook-form'
import type { KafkaConnectionFormType } from '@/src/scheme'
import { TruststoreForm } from './TruststoreForm'
import { getFieldError } from './formUtils'

export interface AuthFormProps {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}

export function SaslGssapiForm({ errors, readOnly }: AuthFormProps) {
  const { register, watch, setValue } = useFormContext()
  const securityProtocolSelected = watch('securityProtocol')
  const showTruststoreFields = securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL'

  const fields = KafkaFormConfig['SASL/GSSAPI'].fields
  const fieldsToRender = Object.entries(fields).filter(([key]) => key !== 'kerberosKeytab' && key !== 'krb5Config')

  const handleKeytabUpload = (fileContent: string, fileName: string) => {
    try {
      setValue('saslGssapi.kerberosKeytab', fileContent, { shouldValidate: true, shouldDirty: true })
      setValue('saslGssapi.kerberosKeytabFileName', fileName, { shouldValidate: false, shouldDirty: true })
    } catch (error) {
      console.error('Error reading keytab file:', error)
    }
  }

  const handleKrb5ConfigUpload = (fileContent: string, fileName: string) => {
    try {
      setValue('saslGssapi.krb5Config', fileContent, { shouldValidate: true, shouldDirty: true })
      setValue('saslGssapi.krb5ConfigFileName', fileName, { shouldValidate: false, shouldDirty: true })
    } catch (error) {
      console.error('Error reading krb5.conf file:', error)
    }
  }

  return (
    <FormGroup className="space-y-4">
      {fieldsToRender.map(([key, field]: [string, Parameters<typeof renderFormField>[0]['field']]) => (
        <div key={key} className="space-y-2 w-full">
          {renderFormField({ field, register, errors, readOnly })}
        </div>
      ))}
      <div className="space-y-2 w-full">
        <InputFile
          label="Kerberos Configuration (krb5.conf) File"
          id="saslGssapi.krb5Config"
          placeholder="Select krb5.conf file"
          allowedFileTypes={['conf', 'txt', 'cfg', 'ini', 'properties']}
          onChange={handleKrb5ConfigUpload}
          value={watch('saslGssapi.krb5Config')}
          initialFileName={watch('saslGssapi.krb5ConfigFileName')}
          readType="text"
          showLoadingState={true}
          showErrorState={true}
          hintText="Accepted formats: .conf, .txt, .cfg, .ini, .properties"
          externalError={errors ? getFieldError(errors, 'saslGssapi.krb5Config') : undefined}
        />
      </div>
      <div className="space-y-2 w-full">
        <InputFile
          label="Kerberos Keytab File"
          id="saslGssapi.kerberosKeytab"
          placeholder="Select keytab file"
          allowedFileTypes={['keytab', 'txt']}
          onChange={handleKeytabUpload}
          value={watch('saslGssapi.kerberosKeytab')}
          initialFileName={watch('saslGssapi.kerberosKeytabFileName')}
          readType="base64"
          showLoadingState={true}
          showErrorState={true}
          hintText="Accepted formats: .keytab, .txt"
          externalError={errors ? getFieldError(errors, 'saslGssapi.kerberosKeytab') : undefined}
        />
      </div>
      {showTruststoreFields && (
        <div className="space-y-4 mt-4">
          <div className="text-sm font-medium text-content">SSL/TLS Configuration</div>
          <TruststoreForm errors={errors} readOnly={readOnly} authMethodPrefix="saslGssapi" />
        </div>
      )}
    </FormGroup>
  )
}
