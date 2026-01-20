'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/src/components/ui/input'
import { Switch } from '@/src/components/ui/switch'
import { cn } from '@/src/utils/common.client'
import type { EmailChannelConfig } from '@/src/services/notifications-api'

interface EmailConfigFormProps {
  initialConfig?: EmailChannelConfig | null
  onChange: (config: EmailChannelConfig, isValid: boolean) => void
  disabled?: boolean
}

interface FormState {
  smtp_host: string
  smtp_port: string
  smtp_username: string
  smtp_password: string
  smtp_use_tls: boolean
  from_address: string
  from_name: string
  to_addresses: string
}

interface FormErrors {
  smtp_host?: string
  smtp_port?: string
  smtp_username?: string
  smtp_password?: string
  to_addresses?: string
}

/**
 * EmailConfigForm Component
 *
 * Form for configuring Email/SMTP settings.
 * Validates required fields and email formats.
 */
export function EmailConfigForm({ initialConfig, onChange, disabled }: EmailConfigFormProps) {
  const [formState, setFormState] = useState<FormState>({
    smtp_host: initialConfig?.smtp_host || '',
    smtp_port: initialConfig?.smtp_port?.toString() || '587',
    smtp_username: initialConfig?.smtp_username || '',
    smtp_password: initialConfig?.smtp_password || '',
    smtp_use_tls: initialConfig?.smtp_use_tls ?? true,
    from_address: initialConfig?.from_address || '',
    from_name: initialConfig?.from_name || '',
    to_addresses: initialConfig?.to_addresses || '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  // Validate comma-separated emails
  const validateEmails = (emails: string): string | undefined => {
    if (!emails.trim()) {
      return 'At least one recipient email is required'
    }
    const emailList = emails.split(',').map((e) => e.trim()).filter(Boolean)
    const invalidEmails = emailList.filter((e) => !isValidEmail(e))
    if (invalidEmails.length > 0) {
      return `Invalid email format: ${invalidEmails.join(', ')}`
    }
    return undefined
  }

  // Validate and notify parent
  const validate = useCallback(() => {
    const newErrors: FormErrors = {}

    if (!formState.smtp_host.trim()) {
      newErrors.smtp_host = 'SMTP host is required'
    }

    const port = parseInt(formState.smtp_port, 10)
    if (isNaN(port) || port < 1 || port > 65535) {
      newErrors.smtp_port = 'Port must be between 1 and 65535'
    }

    if (!formState.smtp_username.trim()) {
      newErrors.smtp_username = 'SMTP username is required'
    }

    if (!formState.smtp_password.trim()) {
      newErrors.smtp_password = 'SMTP password is required'
    }

    const emailError = validateEmails(formState.to_addresses)
    if (emailError) {
      newErrors.to_addresses = emailError
    }

    setErrors(newErrors)

    const isValid = Object.keys(newErrors).length === 0
    const config: EmailChannelConfig = {
      smtp_host: formState.smtp_host.trim(),
      smtp_port: parseInt(formState.smtp_port, 10) || 587,
      smtp_username: formState.smtp_username.trim(),
      smtp_password: formState.smtp_password,
      smtp_use_tls: formState.smtp_use_tls,
      to_addresses: formState.to_addresses.trim(),
      ...(formState.from_address.trim() && { from_address: formState.from_address.trim() }),
      ...(formState.from_name.trim() && { from_name: formState.from_name.trim() }),
    }

    onChange(config, isValid)
  }, [formState, onChange])

  useEffect(() => {
    validate()
  }, [validate])

  // Reset form when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setFormState({
        smtp_host: initialConfig.smtp_host || '',
        smtp_port: initialConfig.smtp_port?.toString() || '587',
        smtp_username: initialConfig.smtp_username || '',
        smtp_password: initialConfig.smtp_password || '',
        smtp_use_tls: initialConfig.smtp_use_tls ?? true,
        from_address: initialConfig.from_address || '',
        from_name: initialConfig.from_name || '',
        to_addresses: initialConfig.to_addresses || '',
      })
    }
  }, [initialConfig])

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const showError = (field: keyof FormErrors) => touched[field] && errors[field]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--surface-border)]">
        <div className="p-2 rounded-[var(--radius-medium)] bg-[var(--color-background-primary-faded)]">
          <Mail className="h-5 w-5 text-[var(--color-foreground-primary)]" />
        </div>
        <div>
          <h3 className="font-medium text-[var(--color-foreground-neutral)]">Email Configuration</h3>
          <p className="text-sm text-[var(--color-foreground-neutral-faded)]">
            Configure SMTP settings for email notifications
          </p>
        </div>
      </div>

      {/* SMTP Server Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">SMTP Server</h4>

        <div className="grid grid-cols-2 gap-4">
          {/* SMTP Host */}
          <div className="modal-input-container">
            <label htmlFor="smtp_host" className="modal-input-label">
              SMTP Host <span className="text-[var(--color-foreground-critical)]">*</span>
            </label>
            <Input
              id="smtp_host"
              type="text"
              value={formState.smtp_host}
              onChange={(e) => handleChange('smtp_host', e.target.value)}
              onBlur={() => handleBlur('smtp_host')}
              placeholder="smtp.gmail.com"
              disabled={disabled}
              className={cn(
                'input-regular',
                showError('smtp_host') ? 'modal-input-error' : 'input-border-regular'
              )}
            />
            {showError('smtp_host') && (
              <p className="modal-error-text animate-slideDown">{errors.smtp_host}</p>
            )}
          </div>

          {/* SMTP Port */}
          <div className="modal-input-container">
            <label htmlFor="smtp_port" className="modal-input-label">
              SMTP Port <span className="text-[var(--color-foreground-critical)]">*</span>
            </label>
            <Input
              id="smtp_port"
              type="number"
              value={formState.smtp_port}
              onChange={(e) => handleChange('smtp_port', e.target.value)}
              onBlur={() => handleBlur('smtp_port')}
              placeholder="587"
              disabled={disabled}
              className={cn(
                'input-regular',
                showError('smtp_port') ? 'modal-input-error' : 'input-border-regular'
              )}
            />
            {showError('smtp_port') && (
              <p className="modal-error-text animate-slideDown">{errors.smtp_port}</p>
            )}
          </div>

          {/* SMTP Username */}
          <div className="modal-input-container">
            <label htmlFor="smtp_username" className="modal-input-label">
              SMTP Username <span className="text-[var(--color-foreground-critical)]">*</span>
            </label>
            <Input
              id="smtp_username"
              type="text"
              value={formState.smtp_username}
              onChange={(e) => handleChange('smtp_username', e.target.value)}
              onBlur={() => handleBlur('smtp_username')}
              placeholder="notifications@example.com"
              disabled={disabled}
              className={cn(
                'input-regular',
                showError('smtp_username') ? 'modal-input-error' : 'input-border-regular'
              )}
            />
            {showError('smtp_username') && (
              <p className="modal-error-text animate-slideDown">{errors.smtp_username}</p>
            )}
          </div>

          {/* SMTP Password */}
          <div className="modal-input-container">
            <label htmlFor="smtp_password" className="modal-input-label">
              SMTP Password <span className="text-[var(--color-foreground-critical)]">*</span>
            </label>
            <div className="relative">
              <Input
                id="smtp_password"
                type={showPassword ? 'text' : 'password'}
                value={formState.smtp_password}
                onChange={(e) => handleChange('smtp_password', e.target.value)}
                onBlur={() => handleBlur('smtp_password')}
                placeholder="Enter SMTP password or app-specific password"
                disabled={disabled}
                className={cn(
                  'input-regular pr-10',
                  showError('smtp_password') ? 'modal-input-error' : 'input-border-regular'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2',
                  'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]',
                  'transition-colors duration-200'
                )}
                disabled={disabled}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {showError('smtp_password') && (
              <p className="modal-error-text animate-slideDown">{errors.smtp_password}</p>
            )}
          </div>

        </div>


        {/* Use TLS */}
        <div className="flex items-center justify-between py-2">
          <div>
            <label htmlFor="smtp_use_tls" className="modal-input-label">
              Use TLS
            </label>
            <p className="modal-input-helper">Enable TLS encryption for SMTP connection</p>
          </div>
          <Switch
            id="smtp_use_tls"
            checked={formState.smtp_use_tls}
            onCheckedChange={(checked) => handleChange('smtp_use_tls', checked)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Sender Settings */}
      <div className="space-y-4 pt-4 border-t border-[var(--surface-border)]">
        <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">Sender Settings</h4>

        <div className="grid grid-cols-2 gap-4">
          {/* From Address */}
          <div className="modal-input-container">
            <label htmlFor="from_address" className="modal-input-label">
              From Address <span className="text-[var(--color-foreground-neutral-faded)]">(optional)</span>
            </label>
            <Input
              id="from_address"
              type="email"
              value={formState.from_address}
              onChange={(e) => handleChange('from_address', e.target.value)}
              placeholder="noreply@glassflow.io"
              disabled={disabled}
              className="input-regular input-border-regular"
            />
          </div>

          {/* From Name */}
          <div className="modal-input-container">
            <label htmlFor="from_name" className="modal-input-label">
              From Name <span className="text-[var(--color-foreground-neutral-faded)]">(optional)</span>
            </label>
            <Input
              id="from_name"
              type="text"
              value={formState.from_name}
              onChange={(e) => handleChange('from_name', e.target.value)}
              placeholder="GlassFlow Notifier"
              disabled={disabled}
              className="input-regular input-border-regular"
            />
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="space-y-4 pt-4 border-t border-[var(--surface-border)]">
        <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">Recipients</h4>

        <div className="modal-input-container">
          <label htmlFor="to_addresses" className="modal-input-label">
            To Addresses <span className="text-[var(--color-foreground-critical)]">*</span>
          </label>
          <Input
            id="to_addresses"
            type="text"
            value={formState.to_addresses}
            onChange={(e) => handleChange('to_addresses', e.target.value)}
            onBlur={() => handleBlur('to_addresses')}
            placeholder="admin@example.com, alerts@example.com"
            disabled={disabled}
            className={cn(
              'input-regular',
              showError('to_addresses') ? 'modal-input-error' : 'input-border-regular'
            )}
          />
          {showError('to_addresses') && (
            <p className="modal-error-text animate-slideDown">{errors.to_addresses}</p>
          )}
          <p className="modal-input-helper">
            Comma-separated list of email addresses to receive notifications
          </p>
        </div>
      </div>
    </div>
  )
}
