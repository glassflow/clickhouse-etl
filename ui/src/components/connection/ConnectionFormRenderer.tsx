'use client'

import { useState, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { renderFormField } from '@/src/components/ui/form'
import { FormGroup } from '@/src/components/ui'
import FormActionButton from '@/src/components/shared/FormActionButton'
import { FormEditActionButtonGroup } from '@/src/components/shared/FormEditActionButtonGroup'

interface FormField {
  name: string
  label: string
  placeholder: string
  required?: string
  type?: string
  options?: any[]
  defaultValue?: string
  noLabel?: boolean
  className?: string
}

interface FormSection {
  title?: string
  description?: string
  fields: FormField[]
  layout?: 'single' | 'double' | 'triple'
}

interface ConnectionFormRendererProps {
  sections: FormSection[]
  readOnly?: boolean
  standalone?: boolean
  onTestConnection?: () => void
  isConnecting?: boolean
  connectionResult?: {
    success: boolean
    message: string
  } | null
  testButtonText?: string
  submitButtonText?: string
}

export function ConnectionFormRenderer({
  sections,
  readOnly = false,
  standalone = false,
  onTestConnection,
  isConnecting = false,
  connectionResult,
  testButtonText = 'Test Connection',
  submitButtonText = 'Continue',
}: ConnectionFormRendererProps) {
  const { register, errors } = useFormContext()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const renderField = (field: FormField, index: number) => (
    <div
      key={field.name}
      className="transition-all duration-300 ease-out"
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      {renderFormField({
        field,
        register,
        errors,
        readOnly,
      })}
    </div>
  )

  const renderSection = (section: FormSection, sectionIndex: number) => {
    const layoutClasses = {
      single: 'w-full',
      double: 'w-full lg:w-1/2',
      triple: 'w-full lg:w-1/3',
    }

    const layoutClass = layoutClasses[section.layout || 'single']

    return (
      <div
        key={sectionIndex}
        className={`transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
        style={{
          animationDelay: `${sectionIndex * 100}ms`,
        }}
      >
        <FormGroup className="space-y-4">
          {section.title && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{section.title}</h3>
              {section.description && <p className="text-sm text-gray-600 mt-1">{section.description}</p>}
            </div>
          )}

          <div className={`flex flex-col lg:flex-row gap-4 ${section.layout === 'double' ? 'lg:flex-wrap' : ''}`}>
            {section.fields.map((field, fieldIndex) => (
              <div key={field.name} className={layoutClass}>
                {renderField(field, fieldIndex)}
              </div>
            ))}
          </div>
        </FormGroup>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Form Sections */}
      {sections.map((section, index) => renderSection(section, index))}

      {/* Action Buttons */}
      <div className="flex gap-4">
        {standalone && (
          <FormEditActionButtonGroup
            editModeDefault={false}
            onEnableEditMode={() => {}}
            onSaveChanges={() => {}}
            onDiscardChanges={() => {}}
          />
        )}

        {!standalone && onTestConnection && (
          <FormActionButton
            onClick={onTestConnection}
            isLoading={isConnecting}
            isSuccess={connectionResult?.success}
            disabled={isConnecting}
            successText={submitButtonText}
            loadingText="Testing..."
            regularText={testButtonText}
            actionType="primary"
            showLoadingIcon={true}
          />
        )}
      </div>
    </div>
  )
}
